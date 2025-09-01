const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  professionalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professional',
    default: null
  },
  service: {
    category: {
      type: String,
      required: true,
      enum: [
        'home_services',
        'technical_services', 
        'professional_services',
        'beauty_wellness',
        'automotive',
        'education',
        'health',
        'cleaning',
        'other'
      ]
    },
    subcategory: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'El título no puede exceder 100 caracteres']
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, 'La descripción no puede exceder 1000 caracteres']
    },
    urgency: {
      type: String,
      enum: ['low', 'medium', 'high', 'emergency'],
      default: 'medium'
    },
    images: [{
      url: String,
      description: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    requirements: [{
      type: String,
      trim: true
    }]
  },
  location: {
    address: {
      street: {
        type: String,
        required: true,
        trim: true
      },
      city: {
        type: String,
        required: true,
        trim: true
      },
      state: {
        type: String,
        required: true,
        trim: true
      },
      zipCode: {
        type: String,
        required: true,
        trim: true
      },
      country: {
        type: String,
        default: 'Colombia',
        trim: true
      },
      fullAddress: {
        type: String,
        required: true,
        trim: true
      }
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      index: '2dsphere'
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: [500, 'Las instrucciones no pueden exceder 500 caracteres']
    },
    accessInfo: {
      buildingNumber: String,
      floor: String,
      apartment: String,
      accessCode: String,
      parkingInfo: String
    }
  },
  scheduling: {
    preferredDate: {
      type: Date,
      required: true,
      validate: {
        validator: function(value) {
          return value >= new Date();
        },
        message: 'La fecha preferida debe ser futura'
      }
    },
    preferredTime: {
      type: String,
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)']
    },
    flexibility: {
      type: String,
      enum: ['strict', 'flexible', 'asap'],
      default: 'flexible'
    },
    estimatedDuration: {
      value: {
        type: Number,
        min: [15, 'La duración mínima es 15 minutos']
      },
      unit: {
        type: String,
        enum: ['minutes', 'hours', 'days'],
        default: 'hours'
      }
    },
    actualStartTime: Date,
    actualEndTime: Date
  },
  pricing: {
    estimatedCost: {
      type: Number,
      min: [0, 'El costo no puede ser negativo']
    },
    quotedCost: {
      type: Number,
      min: [0, 'El costo cotizado no puede ser negativo']
    },
    finalCost: {
      type: Number,
      min: [0, 'El costo final no puede ser negativo']
    },
    currency: {
      type: String,
      enum: ['COP', 'USD'],
      default: 'COP'
    },
    breakdown: {
      serviceCost: Number,
      materialsCost: Number,
      transportCost: Number,
      additionalCosts: [{
        description: String,
        amount: Number
      }]
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'transfer', 'digital_wallet'],
      default: 'card'
    },
    platformFee: {
      type: Number,
      default: 0
    },
    professionalEarnings: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: [
      'pending',        // Esperando profesional
      'quoted',         // Profesional envió cotización
      'accepted',       // Cliente aceptó cotización
      'confirmed',      // Servicio confirmado
      'in_progress',    // Servicio en progreso
      'completed',      // Servicio completado
      'cancelled',      // Cancelado
      'disputed'        // En disputa
    ],
    default: 'pending'
  },
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    }
  }],
  communication: {
    chat: [{
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      message: {
        type: String,
        required: true,
        trim: true,
        maxlength: [1000, 'El mensaje no puede exceder 1000 caracteres']
      },
      messageType: {
        type: String,
        enum: ['text', 'image', 'location', 'file', 'system'],
        default: 'text'
      },
      attachments: [{
        type: String,
        url: String,
        filename: String,
        size: Number
      }],
      timestamp: {
        type: Date,
        default: Date.now
      },
      isRead: {
        type: Boolean,
        default: false
      },
      readAt: Date
    }],
    lastMessageAt: {
      type: Date,
      default: Date.now
    },
    unreadCount: {
      client: {
        type: Number,
        default: 0
      },
      professional: {
        type: Number,
        default: 0
      }
    }
  },
  tracking: {
    professionalLocation: {
      coordinates: [Number],
      lastUpdated: Date,
      isSharing: {
        type: Boolean,
        default: false
      }
    },
    estimatedArrival: Date,
    checkpoints: [{
      type: {
        type: String,
        enum: ['on_way', 'arrived', 'started', 'break', 'completed']
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      location: {
        coordinates: [Number],
        address: String
      },
      notes: String
    }]
  },
  cancellation: {
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancelledAt: Date,
    reason: {
      type: String,
      enum: [
        'client_request',
        'professional_unavailable',
        'weather_conditions',
        'emergency',
        'payment_issues',
        'other'
      ]
    },
    description: {
      type: String,
      trim: true
    },
    refundAmount: {
      type: Number,
      default: 0
    },
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'failed'],
      default: 'pending'
    }
  },
  completion: {
    completedAt: Date,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    workSummary: {
      type: String,
      trim: true
    },
    beforeImages: [{
      url: String,
      description: String
    }],
    afterImages: [{
      url: String,
      description: String
    }],
    materialsUsed: [{
      name: String,
      quantity: Number,
      cost: Number
    }],
    clientSignature: {
      url: String,
      timestamp: Date
    },
    warranty: {
      duration: Number, // días
      terms: String,
      isActive: {
        type: Boolean,
        default: true
      }
    }
  },
  payment: {
    paymentIntentId: String, // Stripe payment intent
    transactionId: String,
    paidAt: Date,
    paymentStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      last4: String,
      brand: String
    },
    receipt: {
      url: String,
      number: String
    }
  },
  review: {
    clientReview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review'
    },
    professionalReview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review'
    },
    clientReviewSubmitted: {
      type: Boolean,
      default: false
    },
    professionalReviewSubmitted: {
      type: Boolean,
      default: false
    }
  },
  metadata: {
    source: {
      type: String,
      enum: ['web', 'mobile_ios', 'mobile_android'],
      default: 'web'
    },
    userAgent: String,
    ipAddress: String,
    referrer: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
serviceRequestSchema.index({ clientId: 1, status: 1 });
serviceRequestSchema.index({ professionalId: 1, status: 1 });
serviceRequestSchema.index({ 'service.category': 1, 'service.subcategory': 1 });
serviceRequestSchema.index({ 'location.coordinates': '2dsphere' });
serviceRequestSchema.index({ 'scheduling.preferredDate': 1 });
serviceRequestSchema.index({ status: 1, createdAt: -1 });
serviceRequestSchema.index({ 'payment.paymentStatus': 1 });

// Virtual para calcular duración total
serviceRequestSchema.virtual('actualDuration').get(function() {
  if (this.scheduling.actualStartTime && this.scheduling.actualEndTime) {
    return Math.round((this.scheduling.actualEndTime - this.scheduling.actualStartTime) / (1000 * 60)); // minutos
  }
  return null;
});

// Virtual para verificar si está vencido
serviceRequestSchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') return false;
  
  const scheduledDateTime = new Date(this.scheduling.preferredDate);
  const [hours, minutes] = this.scheduling.preferredTime.split(':');
  scheduledDateTime.setHours(parseInt(hours), parseInt(minutes));
  
  return new Date() > scheduledDateTime;
});

// Middleware para actualizar historial de estado
serviceRequestSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      updatedBy: this._updatedBy || this.clientId,
      timestamp: new Date()
    });
  }
  next();
});

// Método para agregar mensaje al chat
serviceRequestSchema.methods.addMessage = function(senderId, message, messageType = 'text', attachments = []) {
  const newMessage = {
    senderId,
    message,
    messageType,
    attachments,
    timestamp: new Date()
  };
  
  this.communication.chat.push(newMessage);
  this.communication.lastMessageAt = new Date();
  
  // Actualizar contador de mensajes no leídos
  if (senderId.toString() === this.clientId.toString()) {
    this.communication.unreadCount.professional += 1;
  } else {
    this.communication.unreadCount.client += 1;
  }
  
  return this.save();
};

// Método para marcar mensajes como leídos
serviceRequestSchema.methods.markMessagesAsRead = function(userId) {
  const isClient = userId.toString() === this.clientId.toString();
  
  // Marcar mensajes como leídos
  this.communication.chat.forEach(msg => {
    if (!msg.isRead && msg.senderId.toString() !== userId.toString()) {
      msg.isRead = true;
      msg.readAt = new Date();
    }
  });
  
  // Resetear contador
  if (isClient) {
    this.communication.unreadCount.client = 0;
  } else {
    this.communication.unreadCount.professional = 0;
  }
  
  return this.save();
};

// Método para actualizar estado
serviceRequestSchema.methods.updateStatus = function(newStatus, updatedBy, reason = '', notes = '') {
  this._updatedBy = updatedBy;
  this.status = newStatus;
  
  // Agregar información específica según el estado
  if (newStatus === 'completed') {
    this.completion.completedAt = new Date();
    this.completion.completedBy = updatedBy;
  } else if (newStatus === 'cancelled') {
    this.cancellation.cancelledAt = new Date();
    this.cancellation.cancelledBy = updatedBy;
    if (reason) this.cancellation.reason = reason;
    if (notes) this.cancellation.description = notes;
  } else if (newStatus === 'in_progress') {
    this.scheduling.actualStartTime = new Date();
  }
  
  return this.save();
};

// Método para calcular costo final
serviceRequestSchema.methods.calculateFinalCost = function() {
  let total = this.pricing.quotedCost || this.pricing.estimatedCost || 0;
  
  // Agregar costos adicionales
  if (this.pricing.breakdown && this.pricing.breakdown.additionalCosts) {
    const additionalTotal = this.pricing.breakdown.additionalCosts.reduce((sum, cost) => sum + cost.amount, 0);
    total += additionalTotal;
  }
  
  // Calcular comisión de la plataforma
  const commissionRate = parseFloat(process.env.COMMISSION_RATE) || 0.15;
  const platformFee = total * commissionRate;
  
  this.pricing.finalCost = total;
  this.pricing.platformFee = platformFee;
  this.pricing.professionalEarnings = total - platformFee;
  
  return this.save();
};

// Método para agregar checkpoint de seguimiento
serviceRequestSchema.methods.addTrackingCheckpoint = function(type, location = null, notes = '') {
  const checkpoint = {
    type,
    timestamp: new Date(),
    notes
  };
  
  if (location) {
    checkpoint.location = location;
  }
  
  this.tracking.checkpoints.push(checkpoint);
  
  return this.save();
};

// Método estático para buscar solicitudes por ubicación
serviceRequestSchema.statics.findNearby = function(coordinates, maxDistance = 25000, status = 'pending') {
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: maxDistance
      }
    },
    status: status
  })
  .populate('clientId', 'profile email')
  .sort({ createdAt: -1 });
};

// Método estático para obtener estadísticas
serviceRequestSchema.statics.getStatistics = function(professionalId, startDate, endDate) {
  const matchStage = {
    professionalId: mongoose.Types.ObjectId(professionalId)
  };
  
  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        completedRequests: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        cancelledRequests: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        totalEarnings: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.professionalEarnings', 0] }
        },
        averageRating: { $avg: '$review.rating' }
      }
    }
  ]);
};

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);