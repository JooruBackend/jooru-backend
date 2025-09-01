/**
 * Modelo de Chat
 * Gestiona las conversaciones entre clientes y profesionales
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const chatSchema = new mongoose.Schema({
  // Participantes del chat
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['client', 'professional'],
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // Solicitud de servicio relacionada
  serviceRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceRequest',
    required: true,
    index: true
  },
  
  // Estado del chat
  status: {
    type: String,
    enum: ['active', 'closed', 'archived'],
    default: 'active',
    index: true
  },
  
  // Tipo de chat
  type: {
    type: String,
    enum: ['service_chat', 'support_chat', 'group_chat'],
    default: 'service_chat'
  },
  
  // Último mensaje
  lastMessage: {
    content: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sentAt: {
      type: Date
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'location', 'system'],
      default: 'text'
    }
  },
  
  // Configuración del chat
  settings: {
    // Notificaciones habilitadas
    notificationsEnabled: {
      type: Boolean,
      default: true
    },
    
    // Auto-archivo después de inactividad (días)
    autoArchiveAfterDays: {
      type: Number,
      default: 30
    },
    
    // Permitir archivos
    allowFiles: {
      type: Boolean,
      default: true
    },
    
    // Tamaño máximo de archivo (MB)
    maxFileSize: {
      type: Number,
      default: 10
    }
  },
  
  // Estadísticas
  stats: {
    totalMessages: {
      type: Number,
      default: 0
    },
    
    messagesByParticipant: {
      type: Map,
      of: Number,
      default: new Map()
    },
    
    firstMessageAt: {
      type: Date
    },
    
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  
  // Metadatos
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Información de auditoría
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  closedAt: {
    type: Date
  },
  
  closeReason: {
    type: String,
    enum: ['service_completed', 'service_cancelled', 'user_request', 'inactivity', 'violation']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
chatSchema.index({ 'participants.user': 1, status: 1 });
chatSchema.index({ serviceRequest: 1 });
chatSchema.index({ status: 1, 'stats.lastActivityAt': 1 });
chatSchema.index({ createdAt: 1 });
chatSchema.index({ 'lastMessage.sentAt': -1 });

// Índice compuesto para búsquedas de usuario
chatSchema.index({ 
  'participants.user': 1, 
  'participants.isActive': 1, 
  status: 1 
});

// Virtuals
chatSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

chatSchema.virtual('activeParticipants').get(function() {
  return this.participants.filter(p => p.isActive && !p.leftAt);
});

chatSchema.virtual('participantCount').get(function() {
  return this.activeParticipants.length;
});

chatSchema.virtual('daysSinceLastActivity').get(function() {
  if (!this.stats.lastActivityAt) return 0;
  const now = new Date();
  const diffTime = Math.abs(now - this.stats.lastActivityAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

chatSchema.virtual('shouldAutoArchive').get(function() {
  return this.status === 'active' && 
         this.daysSinceLastActivity >= this.settings.autoArchiveAfterDays;
});

// Métodos de instancia
chatSchema.methods.addParticipant = function(userId, role) {
  // Verificar si ya es participante
  const existingParticipant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (existingParticipant) {
    if (!existingParticipant.isActive) {
      existingParticipant.isActive = true;
      existingParticipant.leftAt = null;
      existingParticipant.joinedAt = new Date();
    }
    return existingParticipant;
  }
  
  const participant = {
    user: userId,
    role: role,
    joinedAt: new Date(),
    isActive: true
  };
  
  this.participants.push(participant);
  return participant;
};

chatSchema.methods.removeParticipant = function(userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (participant) {
    participant.isActive = false;
    participant.leftAt = new Date();
  }
  
  return participant;
};

chatSchema.methods.isParticipant = function(userId) {
  return this.participants.some(
    p => p.user.toString() === userId.toString() && p.isActive
  );
};

chatSchema.methods.getParticipantRole = function(userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString() && p.isActive
  );
  return participant ? participant.role : null;
};

chatSchema.methods.updateLastMessage = function(messageData) {
  this.lastMessage = {
    content: messageData.content,
    sender: messageData.sender,
    sentAt: messageData.sentAt || new Date(),
    type: messageData.type || 'text'
  };
  
  this.stats.lastActivityAt = new Date();
  
  // Incrementar contador de mensajes
  this.stats.totalMessages += 1;
  
  // Actualizar contador por participante
  const senderId = messageData.sender.toString();
  const currentCount = this.stats.messagesByParticipant.get(senderId) || 0;
  this.stats.messagesByParticipant.set(senderId, currentCount + 1);
  
  // Establecer primer mensaje si es necesario
  if (!this.stats.firstMessageAt) {
    this.stats.firstMessageAt = new Date();
  }
};

chatSchema.methods.close = function(userId, reason = 'user_request') {
  this.status = 'closed';
  this.closedBy = userId;
  this.closedAt = new Date();
  this.closeReason = reason;
  
  return this.save();
};

chatSchema.methods.archive = function() {
  this.status = 'archived';
  return this.save();
};

chatSchema.methods.reopen = function() {
  if (this.status === 'closed') {
    this.status = 'active';
    this.closedBy = null;
    this.closedAt = null;
    this.closeReason = null;
    this.stats.lastActivityAt = new Date();
  }
  return this.save();
};

chatSchema.methods.getPublicData = function(userId) {
  const isParticipant = this.isParticipant(userId);
  
  if (!isParticipant) {
    return null;
  }
  
  return {
    id: this._id,
    serviceRequest: this.serviceRequest,
    participants: this.activeParticipants.map(p => ({
      user: p.user,
      role: p.role,
      joinedAt: p.joinedAt
    })),
    status: this.status,
    type: this.type,
    lastMessage: this.lastMessage,
    stats: {
      totalMessages: this.stats.totalMessages,
      lastActivityAt: this.stats.lastActivityAt
    },
    settings: this.settings,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Métodos estáticos
chatSchema.statics.findUserChats = function(userId, options = {}) {
  const query = {
    'participants.user': userId,
    'participants.isActive': true
  };
  
  if (options.status) {
    query.status = options.status;
  } else {
    query.status = { $in: ['active', 'closed'] };
  }
  
  if (options.serviceRequest) {
    query.serviceRequest = options.serviceRequest;
  }
  
  let queryBuilder = this.find(query)
    .populate('participants.user', 'firstName lastName avatar role')
    .populate('serviceRequest', 'title status')
    .populate('lastMessage.sender', 'firstName lastName avatar')
    .sort({ 'lastMessage.sentAt': -1, updatedAt: -1 });
  
  if (options.limit) {
    queryBuilder = queryBuilder.limit(options.limit);
  }
  
  if (options.skip) {
    queryBuilder = queryBuilder.skip(options.skip);
  }
  
  return queryBuilder;
};

chatSchema.statics.findByServiceRequest = function(serviceRequestId) {
  return this.findOne({ serviceRequest: serviceRequestId })
    .populate('participants.user', 'firstName lastName avatar role')
    .populate('serviceRequest', 'title status client professional')
    .populate('lastMessage.sender', 'firstName lastName avatar');
};

chatSchema.statics.createServiceChat = async function(serviceRequestId, clientId, professionalId, createdBy) {
  const chat = new this({
    serviceRequest: serviceRequestId,
    participants: [
      {
        user: clientId,
        role: 'client',
        joinedAt: new Date(),
        isActive: true
      },
      {
        user: professionalId,
        role: 'professional',
        joinedAt: new Date(),
        isActive: true
      }
    ],
    type: 'service_chat',
    status: 'active',
    createdBy: createdBy,
    stats: {
      totalMessages: 0,
      messagesByParticipant: new Map(),
      lastActivityAt: new Date()
    }
  });
  
  return await chat.save();
};

chatSchema.statics.getActiveChatsCount = function(userId) {
  return this.countDocuments({
    'participants.user': userId,
    'participants.isActive': true,
    status: 'active'
  });
};

chatSchema.statics.getChatsForAutoArchive = function() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 días atrás
  
  return this.find({
    status: 'active',
    'stats.lastActivityAt': { $lt: cutoffDate }
  });
};

chatSchema.statics.getStats = async function(filters = {}) {
  const pipeline = [];
  
  // Filtros
  const matchStage = {};
  if (filters.startDate || filters.endDate) {
    matchStage.createdAt = {};
    if (filters.startDate) matchStage.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) matchStage.createdAt.$lte = new Date(filters.endDate);
  }
  if (filters.status) matchStage.status = filters.status;
  if (filters.type) matchStage.type = filters.type;
  
  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }
  
  pipeline.push({
    $group: {
      _id: null,
      totalChats: { $sum: 1 },
      activeChats: {
        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
      },
      closedChats: {
        $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
      },
      archivedChats: {
        $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] }
      },
      totalMessages: { $sum: '$stats.totalMessages' },
      avgMessagesPerChat: { $avg: '$stats.totalMessages' },
      byType: {
        $push: {
          type: '$type',
          status: '$status',
          messageCount: '$stats.totalMessages'
        }
      }
    }
  });
  
  const [stats] = await this.aggregate(pipeline);
  
  if (!stats) {
    return {
      totalChats: 0,
      activeChats: 0,
      closedChats: 0,
      archivedChats: 0,
      totalMessages: 0,
      avgMessagesPerChat: 0,
      byType: {}
    };
  }
  
  // Procesar estadísticas por tipo
  const byType = {};
  stats.byType.forEach(item => {
    if (!byType[item.type]) {
      byType[item.type] = {
        total: 0,
        active: 0,
        closed: 0,
        archived: 0,
        totalMessages: 0
      };
    }
    
    byType[item.type].total++;
    byType[item.type][item.status]++;
    byType[item.type].totalMessages += item.messageCount;
  });
  
  return {
    totalChats: stats.totalChats,
    activeChats: stats.activeChats,
    closedChats: stats.closedChats,
    archivedChats: stats.archivedChats,
    totalMessages: stats.totalMessages,
    avgMessagesPerChat: Math.round(stats.avgMessagesPerChat * 100) / 100,
    byType
  };
};

// Middleware pre-save
chatSchema.pre('save', function(next) {
  // Actualizar timestamp de última actividad si hay cambios relevantes
  if (this.isModified('lastMessage') || this.isModified('participants')) {
    this.stats.lastActivityAt = new Date();
  }
  
  next();
});

// Middleware post-save
chatSchema.post('save', function(doc, next) {
  logger.info('Chat updated:', {
    chatId: doc._id,
    serviceRequest: doc.serviceRequest,
    status: doc.status,
    participantCount: doc.participantCount,
    totalMessages: doc.stats.totalMessages
  });
  
  next();
});

// Middleware para logging de eliminación
chatSchema.pre('remove', function(next) {
  logger.info('Chat being removed:', {
    chatId: this._id,
    serviceRequest: this.serviceRequest,
    status: this.status
  });
  
  next();
});

module.exports = mongoose.model('Chat', chatSchema);