/**
 * Modelo de Mensaje
 * Gestiona los mensajes individuales dentro de los chats
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const messageSchema = new mongoose.Schema({
  // Chat al que pertenece el mensaje
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },
  
  // Usuario que envía el mensaje
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Tipo de mensaje
  type: {
    type: String,
    enum: [
      'text',           // Mensaje de texto
      'image',          // Imagen
      'file',           // Archivo
      'location',       // Ubicación
      'audio',          // Audio
      'video',          // Video
      'system',         // Mensaje del sistema
      'service_update', // Actualización de servicio
      'payment_update', // Actualización de pago
      'quote'           // Cotización
    ],
    required: true,
    default: 'text'
  },
  
  // Contenido del mensaje
  content: {
    // Texto del mensaje
    text: {
      type: String,
      maxlength: 4000
    },
    
    // Información de archivo/media
    media: {
      // URL del archivo
      url: String,
      
      // Nombre original del archivo
      filename: String,
      
      // Tipo MIME
      mimeType: String,
      
      // Tamaño en bytes
      size: Number,
      
      // Dimensiones (para imágenes/videos)
      width: Number,
      height: Number,
      
      // Duración (para audio/video)
      duration: Number,
      
      // Thumbnail (para videos)
      thumbnail: String,
      
      // Metadata adicional
      metadata: mongoose.Schema.Types.Mixed
    },
    
    // Información de ubicación
    location: {
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      },
      address: String,
      name: String // Nombre del lugar
    },
    
    // Información de cotización
    quote: {
      amount: {
        type: Number,
        min: 0
      },
      currency: {
        type: String,
        default: 'COP'
      },
      description: String,
      validUntil: Date,
      items: [{
        description: String,
        quantity: Number,
        unitPrice: Number,
        total: Number
      }],
      terms: String,
      status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'expired'],
        default: 'pending'
      }
    },
    
    // Información de actualización de servicio
    serviceUpdate: {
      type: {
        type: String,
        enum: ['status_change', 'schedule_change', 'location_change', 'other']
      },
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
      description: String
    },
    
    // Información de actualización de pago
    paymentUpdate: {
      type: {
        type: String,
        enum: ['payment_received', 'payment_failed', 'refund_processed', 'invoice_generated']
      },
      amount: Number,
      currency: String,
      paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
      },
      description: String
    }
  },
  
  // Estado del mensaje
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
    default: 'sent',
    index: true
  },
  
  // Información de entrega
  delivery: {
    sentAt: {
      type: Date,
      default: Date.now
    },
    deliveredAt: {
      type: Date
    },
    readAt: {
      type: Date
    },
    readBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      readAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // Mensaje al que responde (para hilos)
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  // Mensajes reenviados
  forwarded: {
    isForwarded: {
      type: Boolean,
      default: false
    },
    originalMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    originalSender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    forwardedAt: {
      type: Date
    }
  },
  
  // Información de edición
  edited: {
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: {
      type: Date
    },
    editHistory: [{
      content: mongoose.Schema.Types.Mixed,
      editedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // Información de eliminación
  deleted: {
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deleteType: {
      type: String,
      enum: ['soft', 'hard'], // soft: oculto, hard: eliminado permanentemente
      default: 'soft'
    }
  },
  
  // Reacciones al mensaje
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    emoji: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadatos adicionales
  metadata: {
    // IP del remitente
    ipAddress: String,
    
    // User agent
    userAgent: String,
    
    // Información del dispositivo
    deviceInfo: {
      platform: String,
      version: String,
      model: String
    },
    
    // Información de la aplicación
    appInfo: {
      version: String,
      build: String
    },
    
    // Datos adicionales
    extra: mongoose.Schema.Types.Mixed
  },
  
  // Configuración de notificaciones
  notifications: {
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: {
      type: Date
    },
    channels: [{
      type: String,
      enum: ['push', 'email', 'sms']
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ chat: 1, status: 1 });
messageSchema.index({ chat: 1, type: 1 });
messageSchema.index({ 'delivery.sentAt': -1 });
messageSchema.index({ 'deleted.isDeleted': 1, chat: 1 });

// Índice de texto para búsqueda
messageSchema.index({ 
  'content.text': 'text',
  'content.quote.description': 'text'
});

// Virtuals
messageSchema.virtual('isRead').get(function() {
  return this.status === 'read' || this.delivery.readAt;
});

messageSchema.virtual('isDelivered').get(function() {
  return ['delivered', 'read'].includes(this.status) || this.delivery.deliveredAt;
});

messageSchema.virtual('hasMedia').get(function() {
  return ['image', 'file', 'audio', 'video'].includes(this.type) && this.content.media;
});

messageSchema.virtual('reactionCount').get(function() {
  return this.reactions.length;
});

messageSchema.virtual('reactionSummary').get(function() {
  const summary = {};
  this.reactions.forEach(reaction => {
    summary[reaction.emoji] = (summary[reaction.emoji] || 0) + 1;
  });
  return summary;
});

// Métodos de instancia
messageSchema.methods.markAsRead = function(userId) {
  if (this.status !== 'read') {
    this.status = 'read';
    this.delivery.readAt = new Date();
  }
  
  // Agregar a la lista de lectores si no está
  const alreadyRead = this.delivery.readBy.some(
    reader => reader.user.toString() === userId.toString()
  );
  
  if (!alreadyRead) {
    this.delivery.readBy.push({
      user: userId,
      readAt: new Date()
    });
  }
  
  return this.save();
};

messageSchema.methods.markAsDelivered = function() {
  if (this.status === 'sent') {
    this.status = 'delivered';
    this.delivery.deliveredAt = new Date();
  }
  return this.save();
};

messageSchema.methods.addReaction = function(userId, emoji) {
  // Remover reacción existente del usuario
  this.reactions = this.reactions.filter(
    reaction => reaction.user.toString() !== userId.toString()
  );
  
  // Agregar nueva reacción
  this.reactions.push({
    user: userId,
    emoji: emoji,
    createdAt: new Date()
  });
  
  return this.save();
};

messageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(
    reaction => reaction.user.toString() !== userId.toString()
  );
  
  return this.save();
};

messageSchema.methods.edit = function(newContent) {
  // Guardar contenido anterior en historial
  if (!this.edited.isEdited) {
    this.edited.editHistory = [];
  }
  
  this.edited.editHistory.push({
    content: this.content,
    editedAt: new Date()
  });
  
  // Actualizar contenido
  this.content = newContent;
  this.edited.isEdited = true;
  this.edited.editedAt = new Date();
  
  return this.save();
};

messageSchema.methods.softDelete = function(userId) {
  this.deleted.isDeleted = true;
  this.deleted.deletedAt = new Date();
  this.deleted.deletedBy = userId;
  this.deleted.deleteType = 'soft';
  
  return this.save();
};

messageSchema.methods.restore = function() {
  this.deleted.isDeleted = false;
  this.deleted.deletedAt = null;
  this.deleted.deletedBy = null;
  
  return this.save();
};

messageSchema.methods.getPublicData = function(userId) {
  // No mostrar mensajes eliminados (excepto al remitente)
  if (this.deleted.isDeleted && this.sender.toString() !== userId.toString()) {
    return {
      id: this._id,
      chat: this.chat,
      type: 'system',
      content: { text: 'Este mensaje fue eliminado' },
      sender: this.sender,
      createdAt: this.createdAt,
      deleted: { isDeleted: true }
    };
  }
  
  return {
    id: this._id,
    chat: this.chat,
    sender: this.sender,
    type: this.type,
    content: this.content,
    status: this.status,
    delivery: {
      sentAt: this.delivery.sentAt,
      deliveredAt: this.delivery.deliveredAt,
      readAt: this.delivery.readAt,
      readBy: this.delivery.readBy
    },
    replyTo: this.replyTo,
    forwarded: this.forwarded,
    edited: this.edited,
    reactions: this.reactions,
    reactionSummary: this.reactionSummary,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Métodos estáticos
messageSchema.statics.findChatMessages = function(chatId, options = {}) {
  const query = { 
    chat: chatId,
    'deleted.isDeleted': { $ne: true }
  };
  
  if (options.type) {
    query.type = options.type;
  }
  
  if (options.sender) {
    query.sender = options.sender;
  }
  
  if (options.since) {
    query.createdAt = { $gte: new Date(options.since) };
  }
  
  let queryBuilder = this.find(query)
    .populate('sender', 'firstName lastName avatar role')
    .populate('replyTo', 'content.text sender type')
    .populate('reactions.user', 'firstName lastName avatar')
    .sort({ createdAt: options.ascending ? 1 : -1 });
  
  if (options.limit) {
    queryBuilder = queryBuilder.limit(options.limit);
  }
  
  if (options.skip) {
    queryBuilder = queryBuilder.skip(options.skip);
  }
  
  return queryBuilder;
};

messageSchema.statics.findUnreadMessages = function(chatId, userId) {
  return this.find({
    chat: chatId,
    sender: { $ne: userId },
    'delivery.readBy.user': { $ne: userId },
    'deleted.isDeleted': { $ne: true }
  }).sort({ createdAt: 1 });
};

messageSchema.statics.markChatAsRead = async function(chatId, userId) {
  const result = await this.updateMany(
    {
      chat: chatId,
      sender: { $ne: userId },
      'delivery.readBy.user': { $ne: userId },
      'deleted.isDeleted': { $ne: true }
    },
    {
      $set: {
        status: 'read',
        'delivery.readAt': new Date()
      },
      $push: {
        'delivery.readBy': {
          user: userId,
          readAt: new Date()
        }
      }
    }
  );
  
  return result;
};

messageSchema.statics.searchMessages = function(chatId, searchTerm, options = {}) {
  const query = {
    chat: chatId,
    'deleted.isDeleted': { $ne: true },
    $text: { $search: searchTerm }
  };
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .populate('sender', 'firstName lastName avatar')
    .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
    .limit(options.limit || 50);
};

messageSchema.statics.getMessageStats = async function(chatId, filters = {}) {
  const pipeline = [
    {
      $match: {
        chat: mongoose.Types.ObjectId(chatId),
        'deleted.isDeleted': { $ne: true },
        ...filters
      }
    },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        messagesByType: {
          $push: {
            type: '$type',
            sender: '$sender'
          }
        },
        messagesBySender: {
          $push: '$sender'
        },
        firstMessage: { $min: '$createdAt' },
        lastMessage: { $max: '$createdAt' },
        totalReactions: { $sum: { $size: '$reactions' } }
      }
    }
  ];
  
  const [stats] = await this.aggregate(pipeline);
  
  if (!stats) {
    return {
      totalMessages: 0,
      messagesByType: {},
      messagesBySender: {},
      firstMessage: null,
      lastMessage: null,
      totalReactions: 0
    };
  }
  
  // Procesar estadísticas por tipo
  const messagesByType = {};
  stats.messagesByType.forEach(msg => {
    messagesByType[msg.type] = (messagesByType[msg.type] || 0) + 1;
  });
  
  // Procesar estadísticas por remitente
  const messagesBySender = {};
  stats.messagesBySender.forEach(senderId => {
    const id = senderId.toString();
    messagesBySender[id] = (messagesBySender[id] || 0) + 1;
  });
  
  return {
    totalMessages: stats.totalMessages,
    messagesByType,
    messagesBySender,
    firstMessage: stats.firstMessage,
    lastMessage: stats.lastMessage,
    totalReactions: stats.totalReactions
  };
};

// Middleware pre-save
messageSchema.pre('save', async function(next) {
  // Actualizar el último mensaje del chat
  if (this.isNew && !this.deleted.isDeleted) {
    const Chat = mongoose.model('Chat');
    await Chat.findByIdAndUpdate(this.chat, {
      $set: {
        'lastMessage.content': this.content.text || this.type,
        'lastMessage.sender': this.sender,
        'lastMessage.sentAt': this.delivery.sentAt,
        'lastMessage.type': this.type,
        'stats.lastActivityAt': new Date()
      },
      $inc: {
        'stats.totalMessages': 1
      }
    });
  }
  
  next();
});

// Middleware post-save
messageSchema.post('save', async function(doc, next) {
  // Enviar notificación si es un mensaje nuevo
  if (doc.isNew && !doc.deleted.isDeleted && doc.type !== 'system') {
    try {
      const NotificationService = require('../services/NotificationService');
      const Chat = mongoose.model('Chat');
      
      const chat = await Chat.findById(doc.chat)
        .populate('participants.user', '_id firstName lastName')
        .populate('serviceRequest', 'title');
      
      if (chat) {
        // Notificar a otros participantes
        const recipients = chat.participants
          .filter(p => p.isActive && p.user._id.toString() !== doc.sender.toString())
          .map(p => p.user._id);
        
        for (const recipientId of recipients) {
          await NotificationService.sendNotification(
            recipientId,
            'NEW_MESSAGE',
            {
              senderName: doc.sender.firstName || 'Usuario',
              serviceTitle: chat.serviceRequest?.title || 'Servicio',
              messagePreview: doc.content.text?.substring(0, 100) || 'Nuevo mensaje'
            },
            {
              channels: ['push', 'in_app'],
              metadata: {
                chatId: doc.chat,
                messageId: doc._id,
                serviceRequestId: chat.serviceRequest
              }
            }
          );
        }
      }
    } catch (error) {
      logger.error('Error sending message notification:', {
        messageId: doc._id,
        chatId: doc.chat,
        error: error.message
      });
    }
  }
  
  logger.info('Message saved:', {
    messageId: doc._id,
    chatId: doc.chat,
    type: doc.type,
    sender: doc.sender,
    isNew: doc.isNew
  });
  
  next();
});

module.exports = mongoose.model('Message', messageSchema);