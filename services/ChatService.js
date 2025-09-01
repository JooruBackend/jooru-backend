/**
 * Servicio de Chat en Tiempo Real
 * Maneja las conexiones WebSocket y la lógica de mensajería
 */

const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const logger = require('../utils/logger');
const NotificationService = require('./NotificationService');

class ChatService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> { socketId, lastSeen, status }
    this.userSockets = new Map(); // socketId -> userId
    this.chatRooms = new Map(); // chatId -> Set of socketIds
    this.typingUsers = new Map(); // chatId -> Set of userIds
    this.onlineUsers = new Set();
  }

  /**
   * Inicializar el servicio de chat con Socket.IO
   */
  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Middleware de autenticación
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('_id firstName lastName avatar role isActive');
        
        if (!user || !user.isActive) {
          return next(new Error('User not found or inactive'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Manejar conexiones
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    logger.info('Chat service initialized with Socket.IO');
  }

  /**
   * Manejar nueva conexión de socket
   */
  handleConnection(socket) {
    const userId = socket.userId;
    
    logger.info('User connected to chat:', {
      userId,
      socketId: socket.id,
      userName: socket.user.firstName
    });

    // Registrar usuario conectado
    this.connectedUsers.set(userId, {
      socketId: socket.id,
      lastSeen: new Date(),
      status: 'online',
      user: socket.user
    });
    
    this.userSockets.set(socket.id, userId);
    this.onlineUsers.add(userId);

    // Unirse a chats del usuario
    this.joinUserChats(socket);

    // Notificar estado online
    this.broadcastUserStatus(userId, 'online');

    // Event listeners
    socket.on('join_chat', (data) => this.handleJoinChat(socket, data));
    socket.on('leave_chat', (data) => this.handleLeaveChat(socket, data));
    socket.on('send_message', (data) => this.handleSendMessage(socket, data));
    socket.on('typing_start', (data) => this.handleTypingStart(socket, data));
    socket.on('typing_stop', (data) => this.handleTypingStop(socket, data));
    socket.on('mark_as_read', (data) => this.handleMarkAsRead(socket, data));
    socket.on('edit_message', (data) => this.handleEditMessage(socket, data));
    socket.on('delete_message', (data) => this.handleDeleteMessage(socket, data));
    socket.on('add_reaction', (data) => this.handleAddReaction(socket, data));
    socket.on('remove_reaction', (data) => this.handleRemoveReaction(socket, data));
    socket.on('get_chat_history', (data) => this.handleGetChatHistory(socket, data));
    socket.on('search_messages', (data) => this.handleSearchMessages(socket, data));
    socket.on('get_online_users', () => this.handleGetOnlineUsers(socket));
    
    // Manejar desconexión
    socket.on('disconnect', () => this.handleDisconnection(socket));
  }

  /**
   * Unir usuario a sus chats activos
   */
  async joinUserChats(socket) {
    try {
      const userChats = await Chat.findUserChats(socket.userId, {
        status: 'active',
        limit: 50
      });

      for (const chat of userChats) {
        const chatId = chat._id.toString();
        socket.join(chatId);
        
        // Registrar en el mapa de salas
        if (!this.chatRooms.has(chatId)) {
          this.chatRooms.set(chatId, new Set());
        }
        this.chatRooms.get(chatId).add(socket.id);
      }

      logger.info('User joined chats:', {
        userId: socket.userId,
        chatCount: userChats.length
      });
    } catch (error) {
      logger.error('Error joining user chats:', error);
    }
  }

  /**
   * Manejar unirse a un chat específico
   */
  async handleJoinChat(socket, data) {
    try {
      const { chatId } = data;
      
      // Verificar que el usuario puede acceder al chat
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.isParticipant(socket.userId)) {
        socket.emit('error', { message: 'No tienes acceso a este chat' });
        return;
      }

      socket.join(chatId);
      
      // Registrar en el mapa de salas
      if (!this.chatRooms.has(chatId)) {
        this.chatRooms.set(chatId, new Set());
      }
      this.chatRooms.get(chatId).add(socket.id);

      // Notificar al chat que el usuario se unió
      socket.to(chatId).emit('user_joined_chat', {
        userId: socket.userId,
        user: socket.user,
        timestamp: new Date()
      });

      socket.emit('joined_chat', { chatId });
      
      logger.info('User joined chat:', {
        userId: socket.userId,
        chatId
      });
    } catch (error) {
      logger.error('Error joining chat:', error);
      socket.emit('error', { message: 'Error al unirse al chat' });
    }
  }

  /**
   * Manejar salir de un chat
   */
  handleLeaveChat(socket, data) {
    try {
      const { chatId } = data;
      
      socket.leave(chatId);
      
      // Remover del mapa de salas
      if (this.chatRooms.has(chatId)) {
        this.chatRooms.get(chatId).delete(socket.id);
        if (this.chatRooms.get(chatId).size === 0) {
          this.chatRooms.delete(chatId);
        }
      }

      // Notificar al chat que el usuario salió
      socket.to(chatId).emit('user_left_chat', {
        userId: socket.userId,
        timestamp: new Date()
      });

      socket.emit('left_chat', { chatId });
      
      logger.info('User left chat:', {
        userId: socket.userId,
        chatId
      });
    } catch (error) {
      logger.error('Error leaving chat:', error);
    }
  }

  /**
   * Manejar envío de mensaje
   */
  async handleSendMessage(socket, data) {
    try {
      const { chatId, type, content, replyTo, metadata } = data;
      
      // Verificar acceso al chat
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.isParticipant(socket.userId)) {
        socket.emit('error', { message: 'No tienes acceso a este chat' });
        return;
      }

      // Crear el mensaje
      const message = new Message({
        chat: chatId,
        sender: socket.userId,
        type: type || 'text',
        content,
        replyTo,
        metadata: {
          ...metadata,
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent']
        }
      });

      await message.save();
      await message.populate('sender', 'firstName lastName avatar role');
      
      if (replyTo) {
        await message.populate('replyTo', 'content.text sender type');
      }

      // Emitir mensaje a todos los participantes del chat
      this.io.to(chatId).emit('new_message', {
        message: message.getPublicData(socket.userId),
        chat: chatId
      });

      // Confirmar envío al remitente
      socket.emit('message_sent', {
        tempId: data.tempId,
        message: message.getPublicData(socket.userId)
      });

      // Detener indicador de escritura
      this.handleTypingStop(socket, { chatId });

      logger.info('Message sent:', {
        messageId: message._id,
        chatId,
        senderId: socket.userId,
        type: message.type
      });
    } catch (error) {
      logger.error('Error sending message:', error);
      socket.emit('message_error', {
        tempId: data.tempId,
        error: 'Error al enviar el mensaje'
      });
    }
  }

  /**
   * Manejar inicio de escritura
   */
  handleTypingStart(socket, data) {
    try {
      const { chatId } = data;
      
      if (!this.typingUsers.has(chatId)) {
        this.typingUsers.set(chatId, new Set());
      }
      
      this.typingUsers.get(chatId).add(socket.userId);
      
      // Notificar a otros usuarios del chat
      socket.to(chatId).emit('user_typing', {
        userId: socket.userId,
        user: socket.user,
        chatId
      });
    } catch (error) {
      logger.error('Error handling typing start:', error);
    }
  }

  /**
   * Manejar fin de escritura
   */
  handleTypingStop(socket, data) {
    try {
      const { chatId } = data;
      
      if (this.typingUsers.has(chatId)) {
        this.typingUsers.get(chatId).delete(socket.userId);
        
        if (this.typingUsers.get(chatId).size === 0) {
          this.typingUsers.delete(chatId);
        }
      }
      
      // Notificar a otros usuarios del chat
      socket.to(chatId).emit('user_stopped_typing', {
        userId: socket.userId,
        chatId
      });
    } catch (error) {
      logger.error('Error handling typing stop:', error);
    }
  }

  /**
   * Manejar marcar como leído
   */
  async handleMarkAsRead(socket, data) {
    try {
      const { chatId, messageId } = data;
      
      if (messageId) {
        // Marcar mensaje específico como leído
        const message = await Message.findById(messageId);
        if (message && message.chat.toString() === chatId) {
          await message.markAsRead(socket.userId);
          
          // Notificar al remitente
          this.io.to(chatId).emit('message_read', {
            messageId,
            readBy: socket.userId,
            readAt: new Date()
          });
        }
      } else {
        // Marcar todos los mensajes del chat como leídos
        await Message.markChatAsRead(chatId, socket.userId);
        
        // Notificar al chat
        this.io.to(chatId).emit('chat_read', {
          chatId,
          readBy: socket.userId,
          readAt: new Date()
        });
      }
    } catch (error) {
      logger.error('Error marking as read:', error);
    }
  }

  /**
   * Manejar edición de mensaje
   */
  async handleEditMessage(socket, data) {
    try {
      const { messageId, newContent } = data;
      
      const message = await Message.findById(messageId);
      if (!message || message.sender.toString() !== socket.userId) {
        socket.emit('error', { message: 'No puedes editar este mensaje' });
        return;
      }

      await message.edit(newContent);
      await message.populate('sender', 'firstName lastName avatar role');

      // Notificar la edición
      this.io.to(message.chat.toString()).emit('message_edited', {
        message: message.getPublicData(socket.userId)
      });
    } catch (error) {
      logger.error('Error editing message:', error);
      socket.emit('error', { message: 'Error al editar el mensaje' });
    }
  }

  /**
   * Manejar eliminación de mensaje
   */
  async handleDeleteMessage(socket, data) {
    try {
      const { messageId } = data;
      
      const message = await Message.findById(messageId);
      if (!message || message.sender.toString() !== socket.userId) {
        socket.emit('error', { message: 'No puedes eliminar este mensaje' });
        return;
      }

      await message.softDelete(socket.userId);

      // Notificar la eliminación
      this.io.to(message.chat.toString()).emit('message_deleted', {
        messageId,
        deletedBy: socket.userId,
        deletedAt: new Date()
      });
    } catch (error) {
      logger.error('Error deleting message:', error);
      socket.emit('error', { message: 'Error al eliminar el mensaje' });
    }
  }

  /**
   * Manejar agregar reacción
   */
  async handleAddReaction(socket, data) {
    try {
      const { messageId, emoji } = data;
      
      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit('error', { message: 'Mensaje no encontrado' });
        return;
      }

      await message.addReaction(socket.userId, emoji);

      // Notificar la reacción
      this.io.to(message.chat.toString()).emit('reaction_added', {
        messageId,
        userId: socket.userId,
        emoji,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error adding reaction:', error);
      socket.emit('error', { message: 'Error al agregar reacción' });
    }
  }

  /**
   * Manejar remover reacción
   */
  async handleRemoveReaction(socket, data) {
    try {
      const { messageId } = data;
      
      const message = await Message.findById(messageId);
      if (!message) {
        socket.emit('error', { message: 'Mensaje no encontrado' });
        return;
      }

      await message.removeReaction(socket.userId);

      // Notificar la remoción
      this.io.to(message.chat.toString()).emit('reaction_removed', {
        messageId,
        userId: socket.userId,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error removing reaction:', error);
      socket.emit('error', { message: 'Error al remover reacción' });
    }
  }

  /**
   * Manejar obtener historial de chat
   */
  async handleGetChatHistory(socket, data) {
    try {
      const { chatId, limit = 50, skip = 0, before } = data;
      
      // Verificar acceso al chat
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.isParticipant(socket.userId)) {
        socket.emit('error', { message: 'No tienes acceso a este chat' });
        return;
      }

      const options = { limit, skip };
      if (before) {
        options.before = before;
      }

      const messages = await Message.findChatMessages(chatId, options);
      
      socket.emit('chat_history', {
        chatId,
        messages: messages.map(msg => msg.getPublicData(socket.userId)),
        hasMore: messages.length === limit
      });
    } catch (error) {
      logger.error('Error getting chat history:', error);
      socket.emit('error', { message: 'Error al obtener historial' });
    }
  }

  /**
   * Manejar búsqueda de mensajes
   */
  async handleSearchMessages(socket, data) {
    try {
      const { chatId, searchTerm, limit = 20 } = data;
      
      // Verificar acceso al chat
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.isParticipant(socket.userId)) {
        socket.emit('error', { message: 'No tienes acceso a este chat' });
        return;
      }

      const messages = await Message.searchMessages(chatId, searchTerm, { limit });
      
      socket.emit('search_results', {
        chatId,
        searchTerm,
        messages: messages.map(msg => msg.getPublicData(socket.userId))
      });
    } catch (error) {
      logger.error('Error searching messages:', error);
      socket.emit('error', { message: 'Error en la búsqueda' });
    }
  }

  /**
   * Manejar obtener usuarios online
   */
  handleGetOnlineUsers(socket) {
    try {
      const onlineUsers = Array.from(this.onlineUsers).map(userId => {
        const userInfo = this.connectedUsers.get(userId);
        return {
          userId,
          status: userInfo?.status || 'offline',
          lastSeen: userInfo?.lastSeen,
          user: userInfo?.user
        };
      });

      socket.emit('online_users', { users: onlineUsers });
    } catch (error) {
      logger.error('Error getting online users:', error);
    }
  }

  /**
   * Manejar desconexión
   */
  handleDisconnection(socket) {
    const userId = socket.userId;
    
    logger.info('User disconnected from chat:', {
      userId,
      socketId: socket.id
    });

    // Limpiar mapas
    this.connectedUsers.delete(userId);
    this.userSockets.delete(socket.id);
    this.onlineUsers.delete(userId);

    // Remover de salas de chat
    for (const [chatId, socketIds] of this.chatRooms.entries()) {
      if (socketIds.has(socket.id)) {
        socketIds.delete(socket.id);
        if (socketIds.size === 0) {
          this.chatRooms.delete(chatId);
        }
      }
    }

    // Limpiar indicadores de escritura
    for (const [chatId, userIds] of this.typingUsers.entries()) {
      if (userIds.has(userId)) {
        userIds.delete(userId);
        if (userIds.size === 0) {
          this.typingUsers.delete(chatId);
        }
        
        // Notificar que dejó de escribir
        this.io.to(chatId).emit('user_stopped_typing', {
          userId,
          chatId
        });
      }
    }

    // Notificar estado offline
    this.broadcastUserStatus(userId, 'offline');
  }

  /**
   * Transmitir estado de usuario
   */
  broadcastUserStatus(userId, status) {
    try {
      this.io.emit('user_status_changed', {
        userId,
        status,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error broadcasting user status:', error);
    }
  }

  /**
   * Enviar mensaje del sistema a un chat
   */
  async sendSystemMessage(chatId, content, metadata = {}) {
    try {
      const message = new Message({
        chat: chatId,
        sender: null, // Mensaje del sistema
        type: 'system',
        content: { text: content },
        metadata
      });

      await message.save();

      // Emitir a todos los participantes del chat
      this.io.to(chatId).emit('new_message', {
        message: message.getPublicData(),
        chat: chatId
      });

      return message;
    } catch (error) {
      logger.error('Error sending system message:', error);
      throw error;
    }
  }

  /**
   * Notificar actualización de servicio
   */
  async notifyServiceUpdate(chatId, updateType, oldValue, newValue, description) {
    try {
      const message = new Message({
        chat: chatId,
        sender: null,
        type: 'service_update',
        content: {
          serviceUpdate: {
            type: updateType,
            oldValue,
            newValue,
            description
          }
        }
      });

      await message.save();

      this.io.to(chatId).emit('service_updated', {
        message: message.getPublicData(),
        updateType,
        oldValue,
        newValue,
        description
      });

      return message;
    } catch (error) {
      logger.error('Error notifying service update:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas del servicio
   */
  getStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      activeChats: this.chatRooms.size,
      typingUsers: Array.from(this.typingUsers.values()).reduce((sum, set) => sum + set.size, 0),
      onlineUsers: this.onlineUsers.size,
      totalSockets: this.userSockets.size
    };
  }

  /**
   * Verificar si el servicio está disponible
   */
  isAvailable() {
    return this.io !== null;
  }
}

// Exportar instancia singleton
module.exports = new ChatService();