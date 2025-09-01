const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'service_request',
      'booking',
      'payment',
      'invoice',
      'message',
      'review',
      'system',
      'subscription',
      'promotion',
      'security'
    ]
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  channels: [{
    type: String,
    enum: ['push', 'email', 'sms', 'in_app', 'realTime']
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  sent: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date
  },
  deliveryStatus: {
    push: {
      sent: { type: Boolean, default: false },
      delivered: { type: Boolean, default: false },
      error: { type: String }
    },
    email: {
      sent: { type: Boolean, default: false },
      delivered: { type: Boolean, default: false },
      error: { type: String }
    },
    sms: {
      sent: { type: Boolean, default: false },
      delivered: { type: Boolean, default: false },
      error: { type: String }
    }
  }
}, {
  timestamps: true
});

// Índices para mejorar el rendimiento
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ read: 1 });
notificationSchema.index({ sent: 1 });

// Método para marcar como leída
notificationSchema.methods.markAsRead = function() {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// Método para marcar como enviada
notificationSchema.methods.markAsSent = function() {
  this.sent = true;
  this.sentAt = new Date();
  return this.save();
};

// Método estático para obtener notificaciones no leídas de un usuario
notificationSchema.statics.getUnreadByUser = function(userId) {
  return this.find({ user: userId, read: false })
    .sort({ createdAt: -1 })
    .populate('user', 'profile.firstName profile.lastName');
};

// Método estático para obtener notificaciones de un usuario con paginación
notificationSchema.statics.getByUserPaginated = function(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'profile.firstName profile.lastName');
};

// Middleware para actualizar sentAt cuando se marca como enviada
notificationSchema.pre('save', function(next) {
  if (this.isModified('sent') && this.sent && !this.sentAt) {
    this.sentAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Notification', notificationSchema);