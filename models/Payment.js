/**
 * Modelo de Pago
 * Gestiona la información de pagos realizados en la plataforma
 */

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Identificación del pago
  paymentId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  
  // Referencia a la solicitud de servicio
  serviceRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceRequest',
    required: true,
    index: true
  },
  
  // Cliente que realiza el pago
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Profesional que recibe el pago
  professional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professional',
    required: true,
    index: true
  },
  
  // Información del monto
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  platformFee: {
    type: Number,
    required: true,
    min: 0
  },
  
  taxes: {
    type: Number,
    default: 0,
    min: 0
  },
  
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Moneda
  currency: {
    type: String,
    default: 'COP',
    enum: ['COP', 'USD', 'EUR']
  },
  
  // Estado del pago
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // Método de pago
  paymentMethod: {
    type: {
      type: String,
      enum: ['card', 'bank_transfer', 'digital_wallet', 'cash'],
      required: true
    },
    provider: {
      type: String, // 'stripe', 'mercadopago', 'wompi', etc.
      required: true
    },
    details: {
      // Para tarjetas
      cardLast4: String,
      cardBrand: String,
      
      // Para transferencias bancarias
      bankName: String,
      accountLast4: String,
      
      // Para billeteras digitales
      walletProvider: String,
      walletAccount: String
    }
  },
  
  // Información del proveedor de pagos
  providerPaymentId: {
    type: String,
    index: true
  },
  
  providerResponse: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Fechas importantes
  processedAt: {
    type: Date
  },
  
  completedAt: {
    type: Date
  },
  
  // Información de reembolso
  refundStatus: {
    type: String,
    enum: ['none', 'pending', 'processing', 'completed', 'failed'],
    default: 'none'
  },
  
  refundAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  refundReason: {
    type: String
  },
  
  refundedAt: {
    type: Date
  },
  
  refundProviderResponse: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Información adicional
  description: {
    type: String
  },
  
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Información de facturación
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  
  // Información de auditoría
  ipAddress: {
    type: String
  },
  
  userAgent: {
    type: String
  },
  
  // Intentos de pago
  attempts: {
    type: Number,
    default: 1,
    min: 1
  },
  
  lastAttemptAt: {
    type: Date,
    default: Date.now
  },
  
  // Notificaciones enviadas
  notificationsSent: {
    client: {
      paymentConfirmation: { type: Boolean, default: false },
      paymentFailed: { type: Boolean, default: false },
      refundProcessed: { type: Boolean, default: false }
    },
    professional: {
      paymentReceived: { type: Boolean, default: false },
      paymentFailed: { type: Boolean, default: false }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compuestos
paymentSchema.index({ client: 1, status: 1 });
paymentSchema.index({ professional: 1, status: 1 });
paymentSchema.index({ serviceRequest: 1, status: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ 'paymentMethod.provider': 1, providerPaymentId: 1 });

// Virtuals
paymentSchema.virtual('netAmount').get(function() {
  return this.totalAmount - this.platformFee - this.taxes;
});

paymentSchema.virtual('isRefundable').get(function() {
  return this.status === 'completed' && this.refundStatus === 'none';
});

paymentSchema.virtual('canBeRetried').get(function() {
  return this.status === 'failed' && this.attempts < 3;
});

// Métodos de instancia
paymentSchema.methods.markAsCompleted = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

paymentSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.metadata = { ...this.metadata, failureReason: reason };
  return this.save();
};

paymentSchema.methods.processRefund = function(amount, reason) {
  this.refundStatus = 'processing';
  this.refundAmount = amount || this.totalAmount;
  this.refundReason = reason;
  return this.save();
};

paymentSchema.methods.completeRefund = function() {
  this.refundStatus = 'completed';
  this.refundedAt = new Date();
  return this.save();
};

// Métodos estáticos
paymentSchema.statics.generatePaymentId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `PAY_${timestamp}_${random}`.toUpperCase();
};

paymentSchema.statics.getPaymentStats = async function(filters = {}) {
  const matchQuery = { ...filters };
  
  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        completedPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failedPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        totalRevenue: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] }
        },
        totalPlatformFees: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$platformFee', 0] }
        },
        totalRefunds: {
          $sum: { $cond: [{ $eq: ['$refundStatus', 'completed'] }, '$refundAmount', 0] }
        },
        avgPaymentAmount: { $avg: '$totalAmount' }
      }
    }
  ]);
  
  return stats[0] || {
    totalPayments: 0,
    completedPayments: 0,
    failedPayments: 0,
    totalRevenue: 0,
    totalPlatformFees: 0,
    totalRefunds: 0,
    avgPaymentAmount: 0
  };
};

// Middleware pre-save
paymentSchema.pre('save', function(next) {
  // Generar ID de pago si no existe
  if (!this.paymentId) {
    this.paymentId = this.constructor.generatePaymentId();
  }
  
  // Actualizar fecha de último intento
  if (this.isModified('status') && this.status === 'processing') {
    this.lastAttemptAt = new Date();
  }
  
  // Marcar fecha de procesamiento
  if (this.isModified('status') && this.status === 'processing' && !this.processedAt) {
    this.processedAt = new Date();
  }
  
  next();
});

// Middleware post-save para notificaciones
paymentSchema.post('save', async function(doc, next) {
  try {
    const NotificationService = require('../utils/notifications');
    
    // Notificar cuando el pago se completa
    if (doc.isModified('status') && doc.status === 'completed') {
      if (!doc.notificationsSent.client.paymentConfirmation) {
        await NotificationService.sendPaymentConfirmation(doc.client, doc);
        doc.notificationsSent.client.paymentConfirmation = true;
        await doc.save();
      }
      
      if (!doc.notificationsSent.professional.paymentReceived) {
        await NotificationService.sendPaymentReceived(doc.professional, doc);
        doc.notificationsSent.professional.paymentReceived = true;
        await doc.save();
      }
    }
    
    // Notificar cuando el pago falla
    if (doc.isModified('status') && doc.status === 'failed') {
      if (!doc.notificationsSent.client.paymentFailed) {
        await NotificationService.sendPaymentFailed(doc.client, doc);
        doc.notificationsSent.client.paymentFailed = true;
        await doc.save();
      }
    }
    
    // Notificar cuando se procesa un reembolso
    if (doc.isModified('refundStatus') && doc.refundStatus === 'completed') {
      if (!doc.notificationsSent.client.refundProcessed) {
        await NotificationService.sendRefundProcessed(doc.client, doc);
        doc.notificationsSent.client.refundProcessed = true;
        await doc.save();
      }
    }
    
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Error enviando notificaciones de pago:', {
      error: error.message,
      paymentId: doc.paymentId
    });
  }
  
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);