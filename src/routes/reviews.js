const express = require('express');
const router = express.Router();
const reviewService = require('../services/reviewService');
const { authenticate } = require('../../middleware/authenticate');
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');

// Rate limiting for review creation
const createReviewLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 reviews per hour
  message: {
    error: 'Demasiadas reseñas creadas. Intenta de nuevo en una hora.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting for reporting reviews
const reportReviewLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Max 3 reports per 15 minutes
  message: {
    error: 'Demasiados reportes enviados. Intenta de nuevo más tarde.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/reviews/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'review-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Max 5 photos per review
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPEG, PNG, WebP)'));
    }
  }
});

// Validation middleware
const validateCreateReview = [
  body('serviceRequestId')
    .isMongoId()
    .withMessage('ID de solicitud de servicio inválido'),
  body('rating')
    .isFloat({ min: 1, max: 5 })
    .withMessage('La calificación debe estar entre 1 y 5'),
  body('comment')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('El comentario no puede exceder 1000 caracteres')
    .trim(),
  body('reviewerType')
    .isIn(['client', 'professional'])
    .withMessage('Tipo de revisor inválido'),
  body('serviceAspects')
    .optional()
    .isObject()
    .withMessage('Los aspectos del servicio deben ser un objeto'),
  body('serviceAspects.quality')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Calificación de calidad inválida'),
  body('serviceAspects.punctuality')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Calificación de puntualidad inválida'),
  body('serviceAspects.communication')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Calificación de comunicación inválida'),
  body('serviceAspects.professionalism')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Calificación de profesionalismo inválida'),
  body('serviceAspects.valueForMoney')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Calificación de relación calidad-precio inválida'),
  body('serviceAspects.cleanliness')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('Calificación de limpieza inválida')
];

const validateUpdateReview = [
  param('reviewId')
    .isMongoId()
    .withMessage('ID de reseña inválido'),
  body('rating')
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage('La calificación debe estar entre 1 y 5'),
  body('comment')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('El comentario no puede exceder 1000 caracteres')
    .trim(),
  body('serviceAspects')
    .optional()
    .isObject()
    .withMessage('Los aspectos del servicio deben ser un objeto')
];

const validateReportReview = [
  param('reviewId')
    .isMongoId()
    .withMessage('ID de reseña inválido'),
  body('reason')
    .isIn([
      'inappropriate_content',
      'fake_review',
      'spam',
      'harassment',
      'discrimination',
      'other'
    ])
    .withMessage('Razón de reporte inválida'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres')
    .trim()
];

const validateResponse = [
  param('reviewId')
    .isMongoId()
    .withMessage('ID de reseña inválido'),
  body('content')
    .isLength({ min: 1, max: 500 })
    .withMessage('La respuesta debe tener entre 1 y 500 caracteres')
    .trim()
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }
  next();
};

// Routes

/**
 * @route   POST /api/reviews
 * @desc    Create a new review
 * @access  Private
 */
router.post('/', 
  authenticate, 
  createReviewLimit,
  upload.array('photos', 5),
  validateCreateReview,
  handleValidationErrors,
  async (req, res) => {
    try {
      const reviewData = {
        serviceRequestId: req.body.serviceRequestId,
        reviewerId: req.user.id,
        revieweeId: req.body.revieweeId,
        reviewerType: req.body.reviewerType,
        rating: {
          overall: req.body.rating,
          aspects: req.body.serviceAspects || {}
        },
        comment: req.body.comment,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          platform: req.get('X-Platform') || 'web'
        }
      };

      // Add photo URLs if files were uploaded
      if (req.files && req.files.length > 0) {
        reviewData.photos = req.files.map(file => ({
          url: `/uploads/reviews/${file.filename}`,
          caption: req.body.photoCaptions ? req.body.photoCaptions[req.files.indexOf(file)] : ''
        }));
      }

      const review = await reviewService.createReview(reviewData);
      
      res.status(201).json({
        success: true,
        message: 'Reseña creada exitosamente',
        data: review
      });
    } catch (error) {
      console.error('Error creating review:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Error interno del servidor',
        code: error.code
      });
    }
  }
);

/**
 * @route   GET /api/reviews/user/:userId
 * @desc    Get reviews for a specific user
 * @access  Public
 */
router.get('/user/:userId',
  [
    param('userId').isMongoId().withMessage('ID de usuario inválido'),
    query('type').optional().isIn(['service', 'client']).withMessage('Tipo de reseña inválido'),
    query('page').optional().isInt({ min: 1 }).withMessage('Página inválida'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Límite inválido'),
    query('sort').optional().isIn(['newest', 'oldest', 'rating_high', 'rating_low', 'helpful']).withMessage('Ordenamiento inválido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const options = {
        reviewType: req.query.type,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sort: req.query.sort || 'newest'
      };

      const result = await reviewService.getReviewsByUser(userId, options);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching user reviews:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener las reseñas'
      });
    }
  }
);

/**
 * @route   GET /api/reviews/reviewer/:userId
 * @desc    Get reviews written by a specific user
 * @access  Private (own reviews only)
 */
router.get('/reviewer/:userId',
  authenticate,
  [
    param('userId').isMongoId().withMessage('ID de usuario inválido'),
    query('page').optional().isInt({ min: 1 }).withMessage('Página inválida'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Límite inválido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Users can only see their own reviews as reviewer
      if (req.user.id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver estas reseñas'
        });
      }

      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10
      };

      const result = await reviewService.getReviewsByReviewer(userId, options);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching reviewer reviews:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener las reseñas'
      });
    }
  }
);

/**
 * @route   GET /api/reviews/service-request/:serviceRequestId
 * @desc    Get reviews for a specific service request
 * @access  Public
 */
router.get('/service-request/:serviceRequestId',
  [
    param('serviceRequestId').isMongoId().withMessage('ID de solicitud de servicio inválido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const reviews = await reviewService.getReviewsByServiceRequest(req.params.serviceRequestId);
      
      res.json({
        success: true,
        data: reviews
      });
    } catch (error) {
      console.error('Error fetching service request reviews:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener las reseñas de la solicitud de servicio'
      });
    }
  }
);

/**
 * @route   GET /api/reviews/:reviewId
 * @desc    Get a specific review by ID
 * @access  Public
 */
router.get('/:reviewId',
  [
    param('reviewId').isMongoId().withMessage('ID de reseña inválido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const review = await reviewService.getReviewById(req.params.reviewId);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Reseña no encontrada'
        });
      }
      
      res.json({
        success: true,
        data: review
      });
    } catch (error) {
      console.error('Error fetching review:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener la reseña'
      });
    }
  }
);

/**
 * @route   PUT /api/reviews/:reviewId
 * @desc    Update a review
 * @access  Private (reviewer only)
 */
router.put('/:reviewId',
  authenticate,
  validateUpdateReview,
  handleValidationErrors,
  async (req, res) => {
    try {
      const review = await reviewService.updateReview(
        req.params.reviewId,
        req.user.id,
        req.body
      );
      
      res.json({
        success: true,
        message: 'Reseña actualizada exitosamente',
        data: review
      });
    } catch (error) {
      console.error('Error updating review:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Error al actualizar la reseña',
        code: error.code
      });
    }
  }
);

/**
 * @route   DELETE /api/reviews/:reviewId
 * @desc    Delete a review
 * @access  Private (reviewer only)
 */
router.delete('/:reviewId',
  authenticate,
  [
    param('reviewId').isMongoId().withMessage('ID de reseña inválido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      await reviewService.deleteReview(req.params.reviewId, req.user.id);
      
      res.json({
        success: true,
        message: 'Reseña eliminada exitosamente'
      });
    } catch (error) {
      console.error('Error deleting review:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Error al eliminar la reseña',
        code: error.code
      });
    }
  }
);

/**
 * @route   POST /api/reviews/:reviewId/helpful
 * @desc    Mark a review as helpful
 * @access  Private
 */
router.post('/:reviewId/helpful',
  authenticate,
  [
    param('reviewId').isMongoId().withMessage('ID de reseña inválido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const review = await reviewService.getReviewById(req.params.reviewId);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Reseña no encontrada'
        });
      }

      await review.markAsHelpful(req.user.id);
      
      res.json({
        success: true,
        message: 'Reseña marcada como útil',
        data: {
          helpfulVotes: review.helpfulVotes
        }
      });
    } catch (error) {
      console.error('Error marking review as helpful:', error);
      res.status(500).json({
        success: false,
        message: 'Error al marcar la reseña como útil'
      });
    }
  }
);

/**
 * @route   DELETE /api/reviews/:reviewId/helpful
 * @desc    Remove helpful mark from a review
 * @access  Private
 */
router.delete('/:reviewId/helpful',
  authenticate,
  [
    param('reviewId').isMongoId().withMessage('ID de reseña inválido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const review = await reviewService.getReviewById(req.params.reviewId);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Reseña no encontrada'
        });
      }

      await review.removeHelpful(req.user.id);
      
      res.json({
        success: true,
        message: 'Marca de útil removida',
        data: {
          helpfulVotes: review.helpfulVotes
        }
      });
    } catch (error) {
      console.error('Error removing helpful mark:', error);
      res.status(500).json({
        success: false,
        message: 'Error al remover la marca de útil'
      });
    }
  }
);

/**
 * @route   POST /api/reviews/:reviewId/response
 * @desc    Add a response to a review
 * @access  Private (reviewee only)
 */
router.post('/:reviewId/response',
  authenticate,
  validateResponse,
  handleValidationErrors,
  async (req, res) => {
    try {
      const review = await reviewService.getReviewById(req.params.reviewId);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Reseña no encontrada'
        });
      }

      // Only the reviewee can respond
      if (review.revieweeId.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para responder a esta reseña'
        });
      }

      // Check if response already exists
      if (review.response && review.response.content) {
        return res.status(400).json({
          success: false,
          message: 'Ya has respondido a esta reseña'
        });
      }

      await review.addResponse(req.body.content);
      
      res.json({
        success: true,
        message: 'Respuesta agregada exitosamente',
        data: review
      });
    } catch (error) {
      console.error('Error adding response:', error);
      res.status(500).json({
        success: false,
        message: 'Error al agregar la respuesta'
      });
    }
  }
);

/**
 * @route   POST /api/reviews/:reviewId/report
 * @desc    Report a review
 * @access  Private
 */
router.post('/:reviewId/report',
  authenticate,
  reportReviewLimit,
  validateReportReview,
  handleValidationErrors,
  async (req, res) => {
    try {
      await reviewService.reportReview(
        req.params.reviewId,
        req.user.id,
        req.body.reason,
        req.body.description
      );
      
      res.json({
        success: true,
        message: 'Reporte enviado exitosamente. Será revisado por nuestro equipo.'
      });
    } catch (error) {
      console.error('Error reporting review:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Error al reportar la reseña',
        code: error.code
      });
    }
  }
);

/**
 * @route   GET /api/reviews/stats/:userId
 * @desc    Get review statistics for a user
 * @access  Public
 */
router.get('/stats/:userId',
  [
    param('userId').isMongoId().withMessage('ID de usuario inválido'),
    query('type').optional().isIn(['service', 'client']).withMessage('Tipo de reseña inválido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const stats = await reviewService.getReviewStats(
        req.params.userId,
        req.query.type
      );
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching review stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener las estadísticas'
      });
    }
  }
);

/**
 * @route   GET /api/reviews/pending/:userId
 * @desc    Get pending reviews for a user
 * @access  Private (own pending reviews only)
 */
router.get('/pending/:userId',
  authenticate,
  [
    param('userId').isMongoId().withMessage('ID de usuario inválido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Users can only see their own pending reviews
      if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver estas reseñas pendientes'
        });
      }

      const pendingReviews = await reviewService.getPendingReviews(req.params.userId);
      
      res.json({
        success: true,
        data: pendingReviews
      });
    } catch (error) {
      console.error('Error fetching pending reviews:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener las reseñas pendientes'
      });
    }
  }
);

/**
 * @route   GET /api/reviews/insights/:userId
 * @desc    Get professional review insights
 * @access  Private (professional only)
 */
router.get('/insights/:userId',
  authenticate,
  [
    param('userId').isMongoId().withMessage('ID de usuario inválido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Only the professional or admin can see insights
      if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver estos insights'
        });
      }

      const insights = await reviewService.getProfessionalInsights(req.params.userId);
      
      res.json({
        success: true,
        data: insights
      });
    } catch (error) {
      console.error('Error fetching professional insights:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener los insights'
      });
    }
  }
);

module.exports = router;