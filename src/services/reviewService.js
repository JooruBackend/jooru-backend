const Review = require('../models/Review');
const User = require('../models/User');
const ServiceRequest = require('../models/ServiceRequest');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { calculateAverageRating } = require('../utils/ratingUtils');
const notificationService = require('./notificationService');

class ReviewService {
  /**
   * Create a new review
   */
  async createReview(reviewData, userId) {
    const {
      serviceRequestId,
      revieweeId,
      rating,
      comment,
      reviewType, // 'service' or 'client'
      serviceAspects = {}
    } = reviewData;

    // Validate required fields
    if (!serviceRequestId || !revieweeId || !rating) {
      throw new ValidationError('Service Request ID, reviewee ID, and rating are required');
    }

    if (rating < 1 || rating > 5) {
      throw new ValidationError('Rating must be between 1 and 5');
    }

    // Check if service request exists and user is authorized
    const serviceRequest = await ServiceRequest.findById(serviceRequestId)
      .populate('clientId')
      .populate('professionalId');

    if (!serviceRequest) {
      throw new NotFoundError('Service request not found');
    }

    // Verify user is part of this service request
    const isClient = serviceRequest.clientId._id.toString() === userId;
    const isProfessional = serviceRequest.professionalId && serviceRequest.professionalId._id.toString() === userId;

    if (!isClient && !isProfessional) {
      throw new ForbiddenError('You are not authorized to review this service request');
    }

    // Verify service request is completed
    if (serviceRequest.status !== 'completed') {
      throw new ValidationError('Can only review completed service requests');
    }

    // Verify reviewee is the other party in the service request
    const expectedRevieweeId = isClient ? serviceRequest.professionalId._id.toString() : serviceRequest.clientId._id.toString();
    if (revieweeId !== expectedRevieweeId) {
      throw new ValidationError('Invalid reviewee for this service request');
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      serviceRequestId: serviceRequestId,
      reviewerId: userId,
      revieweeId: revieweeId
    });

    if (existingReview) {
      throw new ValidationError('Review already exists for this service request');
    }

    // Create the review
    const review = new Review({
      serviceRequestId: serviceRequestId,
      reviewerId: userId,
      revieweeId: revieweeId,
      reviewerType: isClient ? 'client' : 'professional',
      rating: {
        overall: rating,
        aspects: reviewType === 'service' ? serviceAspects : undefined
      },
      comment
    });

    await review.save();

    // Update user's average rating
    await this.updateUserRating(revieweeId);

    // Update service request to mark review as submitted
    const reviewField = isClient ? 'review.clientReviewSubmitted' : 'review.professionalReviewSubmitted';
    await ServiceRequest.findByIdAndUpdate(serviceRequestId, {
      [reviewField]: true
    });

    // Send notification to reviewee
    await notificationService.sendNotification({
      userId: revieweeId,
      type: 'review_received',
      title: 'Nueva reseña recibida',
      message: `Has recibido una nueva reseña de ${rating} estrellas`,
      data: {
        reviewId: review._id,
        serviceRequestId,
        rating
      }
    });

    // Populate review before returning
    await review.populate([
      { path: 'reviewerId', select: 'name avatar userType' },
      { path: 'revieweeId', select: 'name avatar userType' },
      { path: 'serviceRequestId', select: 'service status scheduling' }
    ]);

    return review;
  }

  /**
   * Get reviews for a user
   */
  async getUserReviews(userId, options = {}) {
    const {
      page = 1,
      limit = 10,
      reviewType,
      minRating,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const query = { revieweeId: userId };

    if (reviewType) {
      query.reviewerType = reviewType;
    }

    if (minRating) {
      query['rating.overall'] = { $gte: minRating };
    }

    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const reviews = await Review.find(query)
      .populate('reviewerId', 'name avatar userType')
      .populate('serviceRequestId', 'service scheduling')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Review.countDocuments(query);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get reviews written by a user
   */
  async getReviewsByUser(userId, options = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const query = { reviewerId: userId };
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const reviews = await Review.find(query)
      .populate('revieweeId', 'name avatar userType')
      .populate('serviceRequestId', 'service scheduling')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Review.countDocuments(query);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get review by ID
   */
  async getReviewById(reviewId) {
    const review = await Review.findById(reviewId)
      .populate('reviewerId', 'name avatar userType')
      .populate('revieweeId', 'name avatar userType')
      .populate('serviceRequestId', 'service scheduling status')
      .lean();

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    return review;
  }

  /**
   * Update a review
   */
  async updateReview(reviewId, updateData, userId) {
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // Only the reviewer can update their review
    if (review.reviewerId.toString() !== userId) {
      throw new ForbiddenError('You can only update your own reviews');
    }

    // Check if review is within edit window (e.g., 24 hours)
    const editWindow = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const timeSinceCreation = Date.now() - review.createdAt.getTime();

    if (timeSinceCreation > editWindow) {
      throw new ValidationError('Review can only be edited within 24 hours of creation');
    }

    // Update allowed fields
    const allowedUpdates = ['rating', 'comment'];
    const updates = {};

    if (updateData.rating !== undefined) {
      if (updateData.rating < 1 || updateData.rating > 5) {
        throw new ValidationError('Rating must be between 1 and 5');
      }
      updates['rating.overall'] = updateData.rating;
      if (updateData.serviceAspects) {
        updates['rating.aspects'] = updateData.serviceAspects;
      }
    }

    if (updateData.comment !== undefined) {
      updates.comment = updateData.comment;
    }

    updates.updatedAt = new Date();

    const updatedReview = await Review.findByIdAndUpdate(
      reviewId,
      updates,
      { new: true }
    ).populate([
      { path: 'reviewerId', select: 'name avatar userType' },
      { path: 'revieweeId', select: 'name avatar userType' },
      { path: 'serviceRequestId', select: 'service scheduling status' }
    ]);

    // Update user's average rating if rating changed
    if (updates['rating.overall']) {
      await this.updateUserRating(review.revieweeId);
    }

    return updatedReview;
  }

  /**
   * Delete a review
   */
  async deleteReview(reviewId, userId) {
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // Only the reviewer can delete their review
    if (review.reviewerId.toString() !== userId) {
      throw new ForbiddenError('You can only delete your own reviews');
    }

    // Check if review is within delete window (e.g., 48 hours)
    const deleteWindow = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
    const timeSinceCreation = Date.now() - review.createdAt.getTime();

    if (timeSinceCreation > deleteWindow) {
      throw new ValidationError('Review can only be deleted within 48 hours of creation');
    }

    const revieweeId = review.revieweeId;
    const serviceRequestId = review.serviceRequestId;
    const isServiceReview = review.reviewerType === 'client';

    await Review.findByIdAndDelete(reviewId);

    // Update user's average rating
    await this.updateUserRating(revieweeId);

    // Update service request to mark review as not submitted
    const reviewField = isServiceReview ? 'review.clientReviewSubmitted' : 'review.professionalReviewSubmitted';
    await ServiceRequest.findByIdAndUpdate(serviceRequestId, {
      [reviewField]: false
    });

    return { message: 'Review deleted successfully' };
  }

  /**
   * Report a review
   */
  async reportReview(reviewId, reportData, userId) {
    const { reason, description } = reportData;

    const review = await Review.findById(reviewId);
    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // Can't report your own review
    if (review.reviewerId.toString() === userId) {
      throw new ValidationError('You cannot report your own review');
    }

    // Check if already reported by this user
    const existingReport = review.reports.find(
      report => report.reportedBy.toString() === userId
    );

    if (existingReport) {
      throw new ValidationError('You have already reported this review');
    }

    // Add report
    review.reports.push({
      reportedBy: userId,
      reason,
      description,
      createdAt: new Date()
    });

    await review.save();

    // If review has multiple reports, flag for admin review
    if (review.reports.length >= 3) {
      review.flagged = true;
      await review.save();

      // Notify admins
      await notificationService.notifyAdmins({
        type: 'review_flagged',
        title: 'Review flagged for review',
        message: `Review ${reviewId} has been flagged due to multiple reports`,
        data: { reviewId }
      });
    }

    return { message: 'Review reported successfully' };
  }

  /**
   * Get review statistics for a user
   */
  async getReviewStats(userId) {
    const stats = await Review.aggregate([
      { $match: { revieweeId: userId } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating.overall' },
          ratingDistribution: {
            $push: '$rating.overall'
          }
        }
      }
    ]);

    if (!stats.length) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }

    const result = stats[0];
    
    // Calculate rating distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    result.ratingDistribution.forEach(rating => {
      distribution[rating] = (distribution[rating] || 0) + 1;
    });

    return {
      totalReviews: result.totalReviews,
      averageRating: Math.round(result.averageRating * 10) / 10,
      ratingDistribution: distribution
    };
  }

  /**
   * Update user's average rating
   */
  async updateUserRating(userId) {
    try {
      const stats = await Review.aggregate([
        { $match: { revieweeId: userId } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating.overall' },
            totalReviews: { $sum: 1 }
          }
        }
      ]);

      const { averageRating = 0, totalReviews = 0 } = stats[0] || {};

      // Update user's rating in their profile
      await User.findByIdAndUpdate(userId, {
        'rating.average': Math.round(averageRating * 10) / 10,
        'rating.count': totalReviews
      });

      return {
        totalReviews,
        averageRating: Math.round(averageRating * 10) / 10
      };

    } catch (error) {
      console.error('Error updating user rating:', error);
      return {
        totalReviews: 0,
        averageRating: 0
      };
    }
  }

  /**
   * Get pending reviews for a user
   */
  async getPendingReviews(userId) {
    // Find completed service requests where user hasn't submitted review yet
    const serviceRequests = await ServiceRequest.find({
      $or: [
        {
          clientId: userId,
          status: 'completed',
          'review.clientReviewSubmitted': { $ne: true }
        },
        {
          professionalId: userId,
          status: 'completed',
          'review.professionalReviewSubmitted': { $ne: true }
        }
      ]
    })
    .populate('clientId', 'name avatar')
    .populate('professionalId', 'name avatar')
    .sort({ 'completion.completedAt': -1 })
    .limit(10)
    .lean();

    return serviceRequests.map(serviceRequest => {
      const isClient = serviceRequest.clientId._id.toString() === userId;
      return {
        serviceRequestId: serviceRequest._id,
        service: serviceRequest.service,
        date: serviceRequest.scheduling.preferredDate,
        reviewee: isClient ? serviceRequest.professionalId : serviceRequest.clientId,
        reviewType: isClient ? 'service' : 'client'
      };
    });
  }

  /**
   * Get review insights for professionals
   */
  async getReviewInsights(professionalId) {
    const reviews = await Review.find({
      revieweeId: professionalId,
      reviewerType: 'client'
    }).lean();

    if (!reviews.length) {
      return {
        totalReviews: 0,
        averageRating: 0,
        aspectRatings: {},
        commonKeywords: [],
        monthlyTrend: []
      };
    }

    // Calculate aspect ratings
    const aspectRatings = {};
    const aspectCounts = {};

    reviews.forEach(review => {
      if (review.rating && review.rating.aspects) {
        Object.entries(review.rating.aspects).forEach(([aspect, rating]) => {
          if (!aspectRatings[aspect]) {
            aspectRatings[aspect] = 0;
            aspectCounts[aspect] = 0;
          }
          aspectRatings[aspect] += rating;
          aspectCounts[aspect]++;
        });
      }
    });

    // Average aspect ratings
    Object.keys(aspectRatings).forEach(aspect => {
      aspectRatings[aspect] = Math.round((aspectRatings[aspect] / aspectCounts[aspect]) * 10) / 10;
    });

    // Extract common keywords from comments
    const allComments = reviews
      .filter(review => review.comment)
      .map(review => review.comment.toLowerCase())
      .join(' ');

    const words = allComments.split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['este', 'esta', 'muy', 'bien', 'bueno', 'malo', 'para', 'con', 'por'].includes(word));

    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    const commonKeywords = Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    // Monthly trend (last 12 months)
    const monthlyTrend = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      
      const monthReviews = reviews.filter(review => 
        review.createdAt >= date && review.createdAt < nextDate
      );
      
      const avgRating = monthReviews.length > 0 
        ? monthReviews.reduce((sum, review) => sum + review.rating.overall, 0) / monthReviews.length
        : 0;
      
      monthlyTrend.push({
        month: date.toISOString().slice(0, 7), // YYYY-MM format
        count: monthReviews.length,
        averageRating: Math.round(avgRating * 10) / 10
      });
    }

    return {
      totalReviews: reviews.length,
      averageRating: Math.round((reviews.reduce((sum, review) => sum + review.rating.overall, 0) / reviews.length) * 10) / 10,
      aspectRatings,
      commonKeywords,
      monthlyTrend
    };
  }
}

module.exports = new ReviewService();