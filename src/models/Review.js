const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  // Booking reference
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },

  // User who wrote the review
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // User being reviewed
  reviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Overall rating (1-5 stars)
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: {
      validator: function(v) {
        return Number.isInteger(v * 2); // Allow half stars (1, 1.5, 2, 2.5, etc.)
      },
      message: 'Rating must be in increments of 0.5'
    }
  },

  // Written review comment
  comment: {
    type: String,
    maxlength: 1000,
    trim: true
  },

  // Type of review
  reviewType: {
    type: String,
    enum: ['service', 'client'],
    required: true
  },

  // Detailed service aspect ratings (for service reviews)
  serviceAspects: {
    quality: {
      type: Number,
      min: 1,
      max: 5
    },
    punctuality: {
      type: Number,
      min: 1,
      max: 5
    },
    communication: {
      type: Number,
      min: 1,
      max: 5
    },
    professionalism: {
      type: Number,
      min: 1,
      max: 5
    },
    valueForMoney: {
      type: Number,
      min: 1,
      max: 5
    },
    cleanliness: {
      type: Number,
      min: 1,
      max: 5
    }
  },

  // Review status
  status: {
    type: String,
    enum: ['active', 'hidden', 'flagged', 'deleted'],
    default: 'active'
  },

  // Helpful votes
  helpfulVotes: {
    type: Number,
    default: 0
  },

  // Users who voted this review as helpful
  helpfulBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Response from the reviewee (optional)
  response: {
    content: {
      type: String,
      maxlength: 500,
      trim: true
    },
    createdAt: {
      type: Date
    }
  },

  // Reports against this review
  reports: [{
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      enum: [
        'inappropriate_content',
        'fake_review',
        'spam',
        'harassment',
        'discrimination',
        'other'
      ],
      required: true
    },
    description: {
      type: String,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved'],
      default: 'pending'
    }
  }],

  // Whether this review has been flagged for admin review
  flagged: {
    type: Boolean,
    default: false
  },

  // Admin notes (for moderation)
  adminNotes: {
    type: String,
    maxlength: 500
  },

  // Verification status
  verified: {
    type: Boolean,
    default: true // Reviews are verified by default since they're tied to bookings
  },

  // Photos attached to the review
  photos: [{
    url: {
      type: String,
      required: true
    },
    caption: {
      type: String,
      maxlength: 200
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Metadata
  metadata: {
    // IP address for fraud detection
    ipAddress: String,
    
    // User agent
    userAgent: String,
    
    // Platform (mobile, web)
    platform: String,
    
    // Language of the review
    language: {
      type: String,
      default: 'es'
    },
    
    // Sentiment analysis score (-1 to 1)
    sentimentScore: {
      type: Number,
      min: -1,
      max: 1
    },
    
    // Keywords extracted from the review
    keywords: [String],
    
    // Review length category
    lengthCategory: {
      type: String,
      enum: ['short', 'medium', 'long']
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
reviewSchema.index({ reviewee: 1, createdAt: -1 });
reviewSchema.index({ reviewer: 1, createdAt: -1 });
reviewSchema.index({ booking: 1, reviewer: 1 }, { unique: true }); // Prevent duplicate reviews
reviewSchema.index({ rating: 1 });
reviewSchema.index({ reviewType: 1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ flagged: 1 });
reviewSchema.index({ 'metadata.sentimentScore': 1 });

// Compound indexes
reviewSchema.index({ reviewee: 1, reviewType: 1, status: 1 });
reviewSchema.index({ reviewee: 1, rating: 1, createdAt: -1 });

// Virtual for review age
reviewSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Virtual for formatted rating
reviewSchema.virtual('formattedRating').get(function() {
  return this.rating.toFixed(1);
});

// Virtual for review summary
reviewSchema.virtual('summary').get(function() {
  if (!this.comment) return '';
  return this.comment.length > 100 
    ? this.comment.substring(0, 100) + '...' 
    : this.comment;
});

// Virtual for average service aspect rating
reviewSchema.virtual('averageServiceRating').get(function() {
  if (!this.serviceAspects || this.reviewType !== 'service') return null;
  
  const aspects = Object.values(this.serviceAspects).filter(rating => rating != null);
  if (aspects.length === 0) return null;
  
  const sum = aspects.reduce((total, rating) => total + rating, 0);
  return Math.round((sum / aspects.length) * 10) / 10;
});

// Pre-save middleware
reviewSchema.pre('save', function(next) {
  // Set review length category
  if (this.comment) {
    const length = this.comment.length;
    if (length < 50) {
      this.metadata.lengthCategory = 'short';
    } else if (length < 200) {
      this.metadata.lengthCategory = 'medium';
    } else {
      this.metadata.lengthCategory = 'long';
    }
  }
  
  // Extract keywords from comment
  if (this.comment && this.isModified('comment')) {
    const words = this.comment.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['este', 'esta', 'muy', 'bien', 'bueno', 'malo', 'para', 'con', 'por', 'que', 'una', 'uno'].includes(word));
    
    this.metadata.keywords = [...new Set(words)].slice(0, 10);
  }
  
  next();
});

// Static methods
reviewSchema.statics.getAverageRating = function(userId, reviewType = null) {
  const match = { reviewee: userId, status: 'active' };
  if (reviewType) match.reviewType = reviewType;
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);
};

reviewSchema.statics.getRatingDistribution = function(userId, reviewType = null) {
  const match = { reviewee: userId, status: 'active' };
  if (reviewType) match.reviewType = reviewType;
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

reviewSchema.statics.getTopKeywords = function(userId, limit = 10) {
  return this.aggregate([
    { $match: { reviewee: userId, status: 'active' } },
    { $unwind: '$metadata.keywords' },
    {
      $group: {
        _id: '$metadata.keywords',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

// Instance methods
reviewSchema.methods.markAsHelpful = function(userId) {
  if (!this.helpfulBy.includes(userId)) {
    this.helpfulBy.push(userId);
    this.helpfulVotes += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

reviewSchema.methods.removeHelpful = function(userId) {
  const index = this.helpfulBy.indexOf(userId);
  if (index > -1) {
    this.helpfulBy.splice(index, 1);
    this.helpfulVotes -= 1;
    return this.save();
  }
  return Promise.resolve(this);
};

reviewSchema.methods.addResponse = function(content) {
  this.response = {
    content,
    createdAt: new Date()
  };
  return this.save();
};

reviewSchema.methods.canBeEditedBy = function(userId) {
  // Only reviewer can edit, and only within 24 hours
  const isReviewer = this.reviewer.toString() === userId.toString();
  const editWindow = 24 * 60 * 60 * 1000; // 24 hours
  const withinEditWindow = (Date.now() - this.createdAt.getTime()) < editWindow;
  
  return isReviewer && withinEditWindow;
};

reviewSchema.methods.canBeDeletedBy = function(userId) {
  // Only reviewer can delete, and only within 48 hours
  const isReviewer = this.reviewer.toString() === userId.toString();
  const deleteWindow = 48 * 60 * 60 * 1000; // 48 hours
  const withinDeleteWindow = (Date.now() - this.createdAt.getTime()) < deleteWindow;
  
  return isReviewer && withinDeleteWindow;
};

// Transform function to control JSON output
reviewSchema.methods.toJSON = function() {
  const review = this.toObject();
  
  // Remove sensitive information
  delete review.reports;
  delete review.adminNotes;
  delete review.metadata.ipAddress;
  delete review.metadata.userAgent;
  
  // Only show flagged status to admins
  if (!this.isAdmin) {
    delete review.flagged;
  }
  
  return review;
};

module.exports = mongoose.model('Review', reviewSchema);