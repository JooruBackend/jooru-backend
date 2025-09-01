/**
 * Rutas de Chat y Mensajería
 * Maneja las operaciones REST para chats y mensajes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const ServiceRequest = require('../models/ServiceRequest');
const auth = require('../middleware/authenticate');
const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const ChatService = require('../services/ChatService');
const NotificationService = require('../services/NotificationService');

// Configuración de multer para archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/chat/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    // Tipos de archivo permitidos
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp3|mp4|wav/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

// Middleware para validar errores
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

/**
 * @route   GET /api/chat
 * @desc    Obtener chats del usuario
 * @access  Private
 */
router.get('/', 
  auth,
  query('status').optional().isIn(['active', 'closed', 'archived']),
  query('type').optional().isIn(['service', 'support', 'group']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('skip').optional().isInt({ min: 0 }),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { status, type, limit = 20, skip = 0 } = req.query;
      
      const options = {
        status,
        type,
        limit: parseInt(limit),
        skip: parseInt(skip)
      };
      
      const chats = await Chat.findUserChats(req.user.id, options);
      
      // Obtener conteo de mensajes no leídos para cada chat
      const chatsWithUnread = await Promise.all(
        chats.map(async (chat) => {
          const unreadCount = await Message.countDocuments({
            chat: chat._id,
            sender: { $ne: req.user.id },
            'delivery.readBy.user': { $ne: req.user.id },
            'deleted.isDeleted': { $ne: true }
          });
          
          return {
            ...chat.getPublicData(),
            unreadCount
          };
        })
      );
      
      res.json({
        success: true,
        data: {
          chats: chatsWithUnread,
          hasMore: chats.length === parseInt(limit)
        }
      });
    } catch (error) {
      logger.error('Error getting user chats:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener los chats'
      });
    }
  }
);

/**
 * @route   GET /api/chat/:chatId
 * @desc    Obtener detalles de un chat específico
 * @access  Private
 */
router.get('/:chatId',
  auth,
  [
    param('chatId').isMongoId().withMessage('ID de chat inválido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const chat = await Chat.findById(req.params.chatId)
        .populate('participants.user', 'firstName lastName avatar role')
        .populate('serviceRequest', 'title description status client professional');
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Chat no encontrado'
        });
      }
      
      // Verificar que el usuario es participante
      if (!chat.isParticipant(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este chat'
        });
      }
      
      // Obtener conteo de mensajes no leídos
      const unreadCount = await Message.countDocuments({
        chat: chat._id,
        sender: { $ne: req.user.id },
        'delivery.readBy.user': { $ne: req.user.id },
        'deleted.isDeleted': { $ne: true }
      });
      
      res.json({
        success: true,
        data: {
          ...chat.getPublicData(),
          unreadCount
        }
      });
    } catch (error) {
      logger.error('Error getting chat details:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener detalles del chat'
      });
    }
  }
);

/**
 * @route   POST /api/chat
 * @desc    Crear un nuevo chat
 * @access  Private
 */
router.post('/',
  auth,
  [
    body('serviceRequestId').isMongoId().withMessage('ID de solicitud de servicio inválido'),
    body('type').optional().isIn(['service', 'support', 'group']),
    body('participants').optional().isArray(),
    body('participants.*').optional().isMongoId()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { serviceRequestId, type = 'service', participants = [] } = req.body;
      
      // Verificar que la solicitud de servicio existe
      const serviceRequest = await ServiceRequest.findById(serviceRequestId)
        .populate('client', '_id firstName lastName')
        .populate('professional', '_id firstName lastName');
      
      if (!serviceRequest) {
        return res.status(404).json({
          success: false,
          message: 'Solicitud de servicio no encontrada'
        });
      }
      
      // Verificar que el usuario está involucrado en la solicitud
      const isClient = serviceRequest.client._id.toString() === req.user.id;
      const isProfessional = serviceRequest.professional && 
                            serviceRequest.professional._id.toString() === req.user.id;
      
      if (!isClient && !isProfessional) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para crear este chat'
        });
      }
      
      // Verificar si ya existe un chat para esta solicitud
      const existingChat = await Chat.findByServiceRequest(serviceRequestId);
      if (existingChat) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un chat para esta solicitud de servicio',
          data: { chatId: existingChat._id }
        });
      }
      
      // Crear el chat
      const chat = await Chat.createServiceChat(
        serviceRequestId,
        serviceRequest.client._id,
        serviceRequest.professional?._id,
        participants
      );
      
      // Enviar mensaje de bienvenida
      await ChatService.sendSystemMessage(
        chat._id,
        `Chat iniciado para el servicio: ${serviceRequest.title}`,
        { serviceRequestId }
      );
      
      res.status(201).json({
        success: true,
        message: 'Chat creado exitosamente',
        data: chat.getPublicData()
      });
    } catch (error) {
      logger.error('Error creating chat:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear el chat'
      });
    }
  }
);

/**
 * @route   GET /api/chat/:chatId/messages
 * @desc    Obtener mensajes de un chat
 * @access  Private
 */
router.get('/:chatId/messages',
  auth,
  [
    param('chatId').isMongoId().withMessage('ID de chat inválido'),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('skip').optional().isInt({ min: 0 }),
    query('before').optional().isISO8601(),
    query('type').optional().isIn(['text', 'image', 'file', 'location', 'audio', 'video', 'system'])
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { chatId } = req.params;
      const { limit = 50, skip = 0, before, type } = req.query;
      
      // Verificar acceso al chat
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.isParticipant(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este chat'
        });
      }
      
      const options = {
        limit: parseInt(limit),
        skip: parseInt(skip),
        type
      };
      
      if (before) {
        options.since = new Date(before);
      }
      
      const messages = await Message.findChatMessages(chatId, options);
      
      res.json({
        success: true,
        data: {
          messages: messages.map(msg => msg.getPublicData(req.user.id)),
          hasMore: messages.length === parseInt(limit)
        }
      });
    } catch (error) {
      logger.error('Error getting chat messages:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener los mensajes'
      });
    }
  }
);

/**
 * @route   POST /api/chat/:chatId/messages
 * @desc    Enviar un mensaje
 * @access  Private
 */
router.post('/:chatId/messages',
  auth,
  upload.array('files', 5),
  [
    param('chatId').isMongoId().withMessage('ID de chat inválido'),
    body('type').optional().isIn(['text', 'image', 'file', 'location', 'audio', 'video', 'quote']),
    body('content').notEmpty().withMessage('El contenido es requerido'),
    body('replyTo').optional().isMongoId()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { chatId } = req.params;
      const { type = 'text', content, replyTo } = req.body;
      
      // Verificar acceso al chat
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.isParticipant(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este chat'
        });
      }
      
      let messageContent;
      
      if (type === 'text' || type === 'quote') {
        messageContent = JSON.parse(content);
      } else if (['image', 'file', 'audio', 'video'].includes(type) && req.files?.length > 0) {
        // Procesar archivos subidos
        const file = req.files[0];
        messageContent = {
          media: {
            url: `/uploads/chat/${file.filename}`,
            filename: file.originalname,
            mimeType: file.mimetype,
            size: file.size
          }
        };
        
        // Agregar texto si se proporciona
        if (content) {
          const parsedContent = JSON.parse(content);
          messageContent.text = parsedContent.text;
        }
      } else {
        messageContent = JSON.parse(content);
      }
      
      // Crear el mensaje
      const message = new Message({
        chat: chatId,
        sender: req.user.id,
        type,
        content: messageContent,
        replyTo,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
      
      await message.save();
      await message.populate('sender', 'firstName lastName avatar role');
      
      if (replyTo) {
        await message.populate('replyTo', 'content.text sender type');
      }
      
      res.status(201).json({
        success: true,
        message: 'Mensaje enviado exitosamente',
        data: message.getPublicData(req.user.id)
      });
    } catch (error) {
      logger.error('Error sending message:', error);
      res.status(500).json({
        success: false,
        message: 'Error al enviar el mensaje'
      });
    }
  }
);

/**
 * @route   PUT /api/chat/:chatId/messages/:messageId
 * @desc    Editar un mensaje
 * @access  Private
 */
router.put('/:chatId/messages/:messageId',
  auth,
  [
    param('chatId').isMongoId().withMessage('ID de chat inválido'),
    param('messageId').isMongoId().withMessage('ID de mensaje inválido'),
    body('content').notEmpty().withMessage('El contenido es requerido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Mensaje no encontrado'
        });
      }
      
      // Verificar que el usuario es el remitente
      if (message.sender.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No puedes editar este mensaje'
        });
      }
      
      await message.edit(content);
      await message.populate('sender', 'firstName lastName avatar role');
      
      res.json({
        success: true,
        message: 'Mensaje editado exitosamente',
        data: message.getPublicData(req.user.id)
      });
    } catch (error) {
      logger.error('Error editing message:', error);
      res.status(500).json({
        success: false,
        message: 'Error al editar el mensaje'
      });
    }
  }
);

/**
 * @route   DELETE /api/chat/:chatId/messages/:messageId
 * @desc    Eliminar un mensaje
 * @access  Private
 */
router.delete('/:chatId/messages/:messageId',
  auth,
  [
    param('chatId').isMongoId().withMessage('ID de chat inválido'),
    param('messageId').isMongoId().withMessage('ID de mensaje inválido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Mensaje no encontrado'
        });
      }
      
      // Verificar que el usuario es el remitente
      if (message.sender.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'No puedes eliminar este mensaje'
        });
      }
      
      await message.softDelete(req.user.id);
      
      res.json({
        success: true,
        message: 'Mensaje eliminado exitosamente'
      });
    } catch (error) {
      logger.error('Error deleting message:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar el mensaje'
      });
    }
  }
);

/**
 * @route   POST /api/chat/:chatId/messages/:messageId/reactions
 * @desc    Agregar reacción a un mensaje
 * @access  Private
 */
router.post('/:chatId/messages/:messageId/reactions',
  auth,
  [
    param('chatId').isMongoId().withMessage('ID de chat inválido'),
    param('messageId').isMongoId().withMessage('ID de mensaje inválido'),
    body('emoji').notEmpty().withMessage('El emoji es requerido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Mensaje no encontrado'
        });
      }
      
      await message.addReaction(req.user.id, emoji);
      
      res.json({
        success: true,
        message: 'Reacción agregada exitosamente',
        data: {
          reactions: message.reactions,
          reactionSummary: message.reactionSummary
        }
      });
    } catch (error) {
      logger.error('Error adding reaction:', error);
      res.status(500).json({
        success: false,
        message: 'Error al agregar reacción'
      });
    }
  }
);

/**
 * @route   DELETE /api/chat/:chatId/messages/:messageId/reactions
 * @desc    Remover reacción de un mensaje
 * @access  Private
 */
router.delete('/:chatId/messages/:messageId/reactions',
  auth,
  [
    param('chatId').isMongoId().withMessage('ID de chat inválido'),
    param('messageId').isMongoId().withMessage('ID de mensaje inválido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Mensaje no encontrado'
        });
      }
      
      await message.removeReaction(req.user.id);
      
      res.json({
        success: true,
        message: 'Reacción removida exitosamente',
        data: {
          reactions: message.reactions,
          reactionSummary: message.reactionSummary
        }
      });
    } catch (error) {
      logger.error('Error removing reaction:', error);
      res.status(500).json({
        success: false,
        message: 'Error al remover reacción'
      });
    }
  }
);

/**
 * @route   POST /api/chat/:chatId/read
 * @desc    Marcar mensajes como leídos
 * @access  Private
 */
router.post('/:chatId/read',
  auth,
  [
    param('chatId').isMongoId().withMessage('ID de chat inválido'),
    body('messageId').optional().isMongoId()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { chatId } = req.params;
      const { messageId } = req.body;
      
      // Verificar acceso al chat
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.isParticipant(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este chat'
        });
      }
      
      if (messageId) {
        // Marcar mensaje específico como leído
        const message = await Message.findById(messageId);
        if (message && message.chat.toString() === chatId) {
          await message.markAsRead(req.user.id);
        }
      } else {
        // Marcar todos los mensajes del chat como leídos
        await Message.markChatAsRead(chatId, req.user.id);
      }
      
      res.json({
        success: true,
        message: 'Mensajes marcados como leídos'
      });
    } catch (error) {
      logger.error('Error marking messages as read:', error);
      res.status(500).json({
        success: false,
        message: 'Error al marcar mensajes como leídos'
      });
    }
  }
);

/**
 * @route   GET /api/chat/:chatId/search
 * @desc    Buscar mensajes en un chat
 * @access  Private
 */
router.get('/:chatId/search',
  auth,
  [
    param('chatId').isMongoId().withMessage('ID de chat inválido'),
    query('q').notEmpty().withMessage('Término de búsqueda requerido'),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { chatId } = req.params;
      const { q: searchTerm, limit = 20 } = req.query;
      
      // Verificar acceso al chat
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.isParticipant(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este chat'
        });
      }
      
      const messages = await Message.searchMessages(chatId, searchTerm, {
        limit: parseInt(limit)
      });
      
      res.json({
        success: true,
        data: {
          searchTerm,
          messages: messages.map(msg => msg.getPublicData(req.user.id)),
          total: messages.length
        }
      });
    } catch (error) {
      logger.error('Error searching messages:', error);
      res.status(500).json({
        success: false,
        message: 'Error en la búsqueda'
      });
    }
  }
);

/**
 * @route   GET /api/chat/:chatId/stats
 * @desc    Obtener estadísticas de un chat
 * @access  Private
 */
router.get('/:chatId/stats',
  auth,
  [
    param('chatId').isMongoId().withMessage('ID de chat inválido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { chatId } = req.params;
      
      // Verificar acceso al chat
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.isParticipant(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este chat'
        });
      }
      
      const stats = await Message.getMessageStats(chatId);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting chat stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas'
      });
    }
  }
);

/**
 * @route   PUT /api/chat/:chatId/close
 * @desc    Cerrar un chat
 * @access  Private
 */
router.put('/:chatId/close',
  auth,
  [
    param('chatId').isMongoId().withMessage('ID de chat inválido')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { chatId } = req.params;
      
      const chat = await Chat.findById(chatId);
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Chat no encontrado'
        });
      }
      
      // Verificar permisos (solo participantes pueden cerrar)
      if (!chat.isParticipant(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para cerrar este chat'
        });
      }
      
      await chat.close();
      
      // Enviar mensaje del sistema
      await ChatService.sendSystemMessage(
        chatId,
        'El chat ha sido cerrado',
        { closedBy: req.user.id }
      );
      
      res.json({
        success: true,
        message: 'Chat cerrado exitosamente',
        data: chat.getPublicData()
      });
    } catch (error) {
      logger.error('Error closing chat:', error);
      res.status(500).json({
        success: false,
        message: 'Error al cerrar el chat'
      });
    }
  }
);

module.exports = router;