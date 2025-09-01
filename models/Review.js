const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  serviceRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceRequest',
    required: true
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  revieweeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewerType: {
    type: String,
    enum: ['client', 'professional'],
    required: true
  },
  rating: {
    overall: {
      type: Number,
      required: true,
      min: [1, 'La calificación mínima es 1'],
      max: [5, 'La calificación máxima es 5']
    },
    aspects: {
      punctuality: {
        type: Number,
        min: [1, 'La calificación mínima es 1'],
        max: [5, 'La calificación máxima es 5']
      },
      quality: {
        type: Number,
        min: [1, 'La calificación mínima es 1'],
        max: [5, 'La calificación máxima es 5']
      },
      communication: {
        type: Number,
        min: [1, 'La calificación mínima es 1'],
        max: [5, 'La calificación máxima es 5']
      },
      value: {
        type: Number,
        min: [1, 'La calificación mínima es 1'],
        max: [5, 'La calificación máxima es 5']
      },
      // Aspectos específicos para reseñas de clientes (por profesionales)
      cooperation: {
        type: Number,
        min: [1, 'La calificación mínima es 1'],
        max: [5, 'La calificación máxima es 5']
      },
      clarity: {
        type: Number,
        min: [1, 'La calificación mínima es 1'],
        max: [5, 'La calificación máxima es 5']
      },
      payment: {
        type: Number,
        min: [1, 'La calificación mínima es 1'],
        max: [5, 'La calificación máxima es 5']
      }
    }
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [1000, 'El comentario no puede exceder 1000 caracteres']
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    enum: [
      // Tags positivos
      'excelente_trabajo',
      'muy_profesional',
      'puntual',
      'amable',
      'limpio',
      'eficiente',
      'conocedor',
      'confiable',
      'precio_justo',
      'recomendado',
      'rapido',
      'detallista',
      'honesto',
      'respetuoso',
      'bien_equipado',
      
      // Tags neutrales/constructivos
      'puede_mejorar',
      'precio_alto',
      'tardo_mas_tiempo',
      'comunicacion_regular',
      
      // Tags para clientes (por profesionales)
      'cliente_cooperativo',
      'instrucciones_claras',
      'pago_puntual',
      'respetuoso',
      'flexible',
      'bien_preparado',
      'comunicativo',
      'comprensivo'
    ]
  }],
  images: [{
    url: {
      type: String,
      required: true
    },
    description: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['before', 'after', 'process', 'issue'],
      default: 'after'
    }
  }],
  isPublic: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: Date,
  helpfulVotes: {
    count: {
      type: Number,
      default: 0
    },
    voters: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  response: {
    comment: {
      type: String,
      trim: true,
      maxlength: [500, 'La respuesta no puede exceder 500 caracteres']
    },
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  flags: [{
    flaggedBy: {
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
        'personal_attack',
        'off_topic',
        'other'
      ],
      required: true
    },
    description: {
      type: String,
      trim: true
    },
    flaggedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending'
    }
  }],
  moderation: {
    status: {
      type: String,
      enum: ['approved', 'pending', 'rejected', 'hidden'],
      default: 'approved'
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    moderatedAt: Date,
    moderationNotes: {
      type: String,
      trim: true
    }
  },
  metadata: {
    source: {
      type: String,
      enum: ['web', 'mobile_ios', 'mobile_android'],
      default: 'web'
    },
    ipAddress: String,
    userAgent: String,
    editHistory: [{
      editedAt: {
        type: Date,
        default: Date.now
      },
      previousComment: String,
      previousRating: Number,
      reason: String
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
reviewSchema.index({ serviceRequestId: 1 });
reviewSchema.index({ reviewerId: 1 });
reviewSchema.index({ revieweeId: 1, reviewerType: 1 });
reviewSchema.index({ 'rating.overall': -1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ isPublic: 1, 'moderation.status': 1 });
reviewSchema.index({ tags: 1 });

// Índice compuesto para evitar reseñas duplicadas
reviewSchema.index({ serviceRequestId: 1, reviewerId: 1 }, { unique: true });

// Virtual para verificar si la reseña es reciente
reviewSchema.virtual('isRecent').get(function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return this.createdAt > thirtyDaysAgo;
});

// Virtual para calcular rating promedio de aspectos
reviewSchema.virtual('averageAspectRating').get(function() {
  const aspects = this.rating.aspects;
  const validAspects = Object.values(aspects).filter(rating => rating && rating > 0);
  
  if (validAspects.length === 0) return this.rating.overall;
  
  const sum = validAspects.reduce((total, rating) => total + rating, 0);
  return Math.round((sum / validAspects.length) * 10) / 10;
});

// Virtual para verificar si ha sido editada
reviewSchema.virtual('isEdited').get(function() {
  return this.metadata.editHistory && this.metadata.editHistory.length > 0;
});

// Middleware para validar que el reviewer no sea el mismo que el reviewee
reviewSchema.pre('save', function(next) {
  if (this.reviewerId.toString() === this.revieweeId.toString()) {
    return next(new Error('No puedes escribir una reseña sobre ti mismo'));
  }
  next();
});

// Middleware para calcular rating overall si no se proporciona
reviewSchema.pre('save', function(next) {
  if (!this.rating.overall && this.rating.aspects) {
    const aspects = this.rating.aspects;
    const validAspects = Object.values(aspects).filter(rating => rating && rating > 0);
    
    if (validAspects.length > 0) {
      const sum = validAspects.reduce((total, rating) => total + rating, 0);
      this.rating.overall = Math.round(sum / validAspects.length);
    }
  }
  next();
});

// Método para agregar voto útil
reviewSchema.methods.addHelpfulVote = function(userId) {
  if (!this.helpfulVotes.voters.includes(userId)) {
    this.helpfulVotes.voters.push(userId);
    this.helpfulVotes.count += 1;
    return this.save();
  }
  throw new Error('Ya has votado por esta reseña');
};

// Método para remover voto útil
reviewSchema.methods.removeHelpfulVote = function(userId) {
  const index = this.helpfulVotes.voters.indexOf(userId);
  if (index > -1) {
    this.helpfulVotes.voters.splice(index, 1);
    this.helpfulVotes.count -= 1;
    return this.save();
  }
  throw new Error('No has votado por esta reseña');
};

// Método para agregar respuesta
reviewSchema.methods.addResponse = function(comment, responderId) {
  this.response = {
    comment,
    respondedAt: new Date(),
    respondedBy: responderId
  };
  return this.save();
};

// Método para reportar reseña
reviewSchema.methods.flag = function(flaggedBy, reason, description = '') {
  this.flags.push({
    flaggedBy,
    reason,
    description,
    flaggedAt: new Date()
  });
  return this.save();
};

// Método para editar reseña
reviewSchema.methods.edit = function(newComment, newRating, reason = '') {
  // Guardar versión anterior en historial
  this.metadata.editHistory.push({
    editedAt: new Date(),
    previousComment: this.comment,
    previousRating: this.rating.overall,
    reason
  });
  
  // Actualizar con nuevos valores
  if (newComment !== undefined) this.comment = newComment;
  if (newRating !== undefined) this.rating.overall = newRating;
  
  return this.save();
};

// Método estático para obtener estadísticas de un usuario
reviewSchema.statics.getUserStats = function(userId, userType = 'professional') {
  const matchField = userType === 'professional' ? 'revieweeId' : 'reviewerId';
  
  return this.aggregate([
    {
      $match: {
        [matchField]: mongoose.Types.ObjectId(userId),
        isPublic: true,
        'moderation.status': 'approved'
      }
    },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating.overall' },
        ratingDistribution: {
          $push: '$rating.overall'
        },
        averageAspects: {
          punctuality: { $avg: '$rating.aspects.punctuality' },
          quality: { $avg: '$rating.aspects.quality' },
          communication: { $avg: '$rating.aspects.communication' },
          value: { $avg: '$rating.aspects.value' }
        },
        commonTags: {
          $push: '$tags'
        },
        recentReviews: {
          $push: {
            $cond: [
              { $gte: ['$createdAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
              '$$ROOT',
              null
            ]
          }
        }
      }
    },
    {
      $project: {
        totalReviews: 1,
        averageRating: { $round: ['$averageRating', 1] },
        ratingDistribution: {
          5: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 5] }
              }
            }
          },
          4: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 4] }
              }
            }
          },
          3: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 3] }
              }
            }
          },
          2: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 2] }
              }
            }
          },
          1: {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 1] }
              }
            }
          }
        },
        averageAspects: {
          punctuality: { $round: ['$averageAspects.punctuality', 1] },
          quality: { $round: ['$averageAspects.quality', 1] },
          communication: { $round: ['$averageAspects.communication', 1] },
          value: { $round: ['$averageAspects.value', 1] }
        },
        recentReviewsCount: {
          $size: {
            $filter: {
              input: '$recentReviews',
              cond: { $ne: ['$$this', null] }
            }
          }
        }
      }
    }
  ]);
};

// Método estático para obtener reseñas con filtros
reviewSchema.statics.getFilteredReviews = function(filters = {}) {
  const {
    revieweeId,
    reviewerType,
    minRating,
    maxRating,
    tags,
    sortBy = 'createdAt',
    sortOrder = -1,
    page = 1,
    limit = 10
  } = filters;
  
  const query = {
    isPublic: true,
    'moderation.status': 'approved'
  };
  
  if (revieweeId) query.revieweeId = revieweeId;
  if (reviewerType) query.reviewerType = reviewerType;
  if (minRating) query['rating.overall'] = { ...query['rating.overall'], $gte: minRating };
  if (maxRating) query['rating.overall'] = { ...query['rating.overall'], $lte: maxRating };
  if (tags && tags.length > 0) query.tags = { $in: tags };
  
  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder };
  
  return this.find(query)
    .populate('reviewerId', 'profile.firstName profile.lastName profile.avatar')
    .populate('serviceRequestId', 'service.title service.category')
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

// Método estático para obtener tags más comunes
reviewSchema.statics.getPopularTags = function(revieweeId, limit = 10) {
  return this.aggregate([
    {
      $match: {
        revieweeId: mongoose.Types.ObjectId(revieweeId),
        isPublic: true,
        'moderation.status': 'approved'
      }
    },
    { $unwind: '$tags' },
    {
      $group: {
        _id: '$tags',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    {
      $project: {
        tag: '$_id',
        count: 1,
        _id: 0
      }
    }
  ]);
};

module.exports = mongoose.model('Review', reviewSchema);