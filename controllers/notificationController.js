/**
 * Controlador para gestión de notificaciones
 * Maneja el envío, recepción y gestión de notificaciones del sistema
 */

const Notification = require('../models/Notification');
const User = require('../models/User');
const { NotificationService } = require('../utils/notifications');
const logger = require('../utils/logger');

class NotificationController {
  /**
   * Obtener notificaciones del usuario
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async getUserNotifications(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        isRead,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const query = { recipient: req.userId };

      // Filtros opcionales
      if (type) {
        query.type = type;
      }

      if (isRead !== undefined) {
        query.isRead = isRead === 'true';
      }

      // Configurar ordenamiento
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Buscar notificaciones
      const notifications = await Notification.find(query)
        .populate('sender', 'firstName lastName profileImage')
        .populate('relatedService', 'title category')
        .populate('relatedQuote', 'price description')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Notification.countDocuments(query);
      const unreadCount = await Notification.countDocuments({
        recipient: req.userId,
        isRead: false
      });

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasNext: skip + parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      };

      return res.paginated(notifications, pagination, 'Notificaciones obtenidas exitosamente', {
        unreadCount
      });

    } catch (error) {
      logger.error('Error obteniendo notificaciones del usuario:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId
      });
      return res.serverError('Error obteniendo las notificaciones');
    }
  }

  /**
   * Marcar notificación como leída
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async markAsRead(req, res) {
    try {
      const { notificationId } = req.params;

      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: req.userId
      });

      if (!notification) {
        return res.notFound('Notificación no encontrada');
      }

      if (!notification.isRead) {
        notification.isRead = true;
        notification.readAt = new Date();
        await notification.save();
      }

      return res.success(notification, 'Notificación marcada como leída');

    } catch (error) {
      logger.error('Error marcando notificación como leída:', {
        error: error.message,
        stack: error.stack,
        notificationId: req.params.notificationId,
        userId: req.userId
      });
      return res.serverError('Error marcando la notificación como leída');
    }
  }

  /**
   * Marcar todas las notificaciones como leídas
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async markAllAsRead(req, res) {
    try {
      const result = await Notification.updateMany(
        {
          recipient: req.userId,
          isRead: false
        },
        {
          isRead: true,
          readAt: new Date()
        }
      );

      logger.info('Notificaciones marcadas como leídas:', {
        userId: req.userId,
        modifiedCount: result.modifiedCount
      });

      return res.success(
        { modifiedCount: result.modifiedCount },
        'Todas las notificaciones han sido marcadas como leídas'
      );

    } catch (error) {
      logger.error('Error marcando todas las notificaciones como leídas:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId
      });
      return res.serverError('Error marcando las notificaciones como leídas');
    }
  }

  /**
   * Eliminar una notificación
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async deleteNotification(req, res) {
    try {
      const { notificationId } = req.params;

      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: req.userId
      });

      if (!notification) {
        return res.notFound('Notificación no encontrada');
      }

      logger.info('Notificación eliminada:', {
        notificationId,
        userId: req.userId,
        type: notification.type
      });

      return res.success(null, 'Notificación eliminada exitosamente');

    } catch (error) {
      logger.error('Error eliminando notificación:', {
        error: error.message,
        stack: error.stack,
        notificationId: req.params.notificationId,
        userId: req.userId
      });
      return res.serverError('Error eliminando la notificación');
    }
  }

  /**
   * Eliminar todas las notificaciones leídas
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async deleteReadNotifications(req, res) {
    try {
      const result = await Notification.deleteMany({
        recipient: req.userId,
        isRead: true
      });

      logger.info('Notificaciones leídas eliminadas:', {
        userId: req.userId,
        deletedCount: result.deletedCount
      });

      return res.success(
        { deletedCount: result.deletedCount },
        'Notificaciones leídas eliminadas exitosamente'
      );

    } catch (error) {
      logger.error('Error eliminando notificaciones leídas:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId
      });
      return res.serverError('Error eliminando las notificaciones');
    }
  }

  /**
   * Obtener conteo de notificaciones no leídas
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async getUnreadCount(req, res) {
    try {
      const unreadCount = await Notification.countDocuments({
        recipient: req.userId,
        isRead: false
      });

      return res.success({ unreadCount }, 'Conteo de notificaciones no leídas obtenido');

    } catch (error) {
      logger.error('Error obteniendo conteo de notificaciones no leídas:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId
      });
      return res.serverError('Error obteniendo el conteo de notificaciones');
    }
  }

  /**
   * Obtener configuración de notificaciones del usuario
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async getNotificationSettings(req, res) {
    try {
      const user = await User.findById(req.userId).select('notificationSettings');
      
      if (!user) {
        return res.notFound('Usuario no encontrado');
      }

      // Configuración por defecto si no existe
      const defaultSettings = {
        email: {
          newQuote: true,
          quoteAccepted: true,
          quoteRejected: true,
          serviceCompleted: true,
          newMessage: true,
          paymentReceived: true,
          systemUpdates: false
        },
        push: {
          newQuote: true,
          quoteAccepted: true,
          quoteRejected: false,
          serviceCompleted: true,
          newMessage: true,
          paymentReceived: true,
          systemUpdates: false
        },
        sms: {
          newQuote: false,
          quoteAccepted: true,
          quoteRejected: false,
          serviceCompleted: true,
          newMessage: false,
          paymentReceived: true,
          systemUpdates: false
        }
      };

      const settings = user.notificationSettings || defaultSettings;

      return res.success(settings, 'Configuración de notificaciones obtenida');

    } catch (error) {
      logger.error('Error obteniendo configuración de notificaciones:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId
      });
      return res.serverError('Error obteniendo la configuración');
    }
  }

  /**
   * Actualizar configuración de notificaciones del usuario
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async updateNotificationSettings(req, res) {
    try {
      const { email, push, sms } = req.body;

      // Validar estructura de configuración
      const validChannels = ['email', 'push', 'sms'];
      const validTypes = [
        'newQuote', 'quoteAccepted', 'quoteRejected', 'serviceCompleted',
        'newMessage', 'paymentReceived', 'systemUpdates'
      ];

      const settings = {};
      
      [email, push, sms].forEach((channelSettings, index) => {
        const channelName = validChannels[index];
        if (channelSettings && typeof channelSettings === 'object') {
          settings[channelName] = {};
          validTypes.forEach(type => {
            if (typeof channelSettings[type] === 'boolean') {
              settings[channelName][type] = channelSettings[type];
            }
          });
        }
      });

      const user = await User.findByIdAndUpdate(
        req.userId,
        { notificationSettings: settings },
        { new: true, runValidators: true }
      ).select('notificationSettings');

      if (!user) {
        return res.notFound('Usuario no encontrado');
      }

      logger.info('Configuración de notificaciones actualizada:', {
        userId: req.userId,
        settings: Object.keys(settings)
      });

      return res.success(
        user.notificationSettings,
        'Configuración de notificaciones actualizada exitosamente'
      );

    } catch (error) {
      logger.error('Error actualizando configuración de notificaciones:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId
      });
      return res.serverError('Error actualizando la configuración');
    }
  }

  /**
   * Enviar notificación de prueba
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async sendTestNotification(req, res) {
    try {
      const { type = 'test', channel = 'push' } = req.body;

      const testNotification = {
        recipient: req.userId,
        type: 'system',
        title: 'Notificación de Prueba',
        message: 'Esta es una notificación de prueba para verificar que el sistema funciona correctamente.',
        data: {
          testType: type,
          timestamp: new Date().toISOString()
        }
      };

      // Crear notificación en la base de datos
      const notification = new Notification(testNotification);
      await notification.save();

      // Enviar según el canal especificado
      try {
        switch (channel) {
          case 'email':
            await NotificationService.sendEmailNotification(
              req.userId,
              testNotification.title,
              testNotification.message
            );
            break;
          case 'push':
            await NotificationService.sendPushNotification(
              req.userId,
              testNotification.title,
              testNotification.message,
              testNotification.data
            );
            break;
          case 'sms':
            await NotificationService.sendSMSNotification(
              req.userId,
              testNotification.message
            );
            break;
          default:
            return res.error('Canal de notificación no válido', 400);
        }
      } catch (sendError) {
        logger.warn('Error enviando notificación de prueba:', {
          error: sendError.message,
          channel,
          userId: req.userId
        });
      }

      logger.info('Notificación de prueba enviada:', {
        userId: req.userId,
        type,
        channel
      });

      return res.success(
        { notification, channel },
        'Notificación de prueba enviada exitosamente'
      );

    } catch (error) {
      logger.error('Error enviando notificación de prueba:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId
      });
      return res.serverError('Error enviando la notificación de prueba');
    }
  }

  /**
   * Obtener estadísticas de notificaciones (Admin)
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async getNotificationStats(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      const matchQuery = {};
      if (startDate || endDate) {
        matchQuery.createdAt = {};
        if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
        if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
      }

      const stats = await Notification.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalNotifications: { $sum: 1 },
            readNotifications: {
              $sum: { $cond: ['$isRead', 1, 0] }
            },
            unreadNotifications: {
              $sum: { $cond: ['$isRead', 0, 1] }
            },
            notificationsByType: {
              $push: '$type'
            }
          }
        },
        {
          $project: {
            totalNotifications: 1,
            readNotifications: 1,
            unreadNotifications: 1,
            readRate: {
              $cond: [
                { $gt: ['$totalNotifications', 0] },
                { $multiply: [{ $divide: ['$readNotifications', '$totalNotifications'] }, 100] },
                0
              ]
            },
            notificationsByType: 1
          }
        }
      ]);

      // Contar notificaciones por tipo
      const typeStats = await Notification.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            readCount: { $sum: { $cond: ['$isRead', 1, 0] } }
          }
        },
        {
          $project: {
            type: '$_id',
            count: 1,
            readCount: 1,
            readRate: {
              $cond: [
                { $gt: ['$count', 0] },
                { $multiply: [{ $divide: ['$readCount', '$count'] }, 100] },
                0
              ]
            }
          }
        }
      ]);

      const result = {
        overview: stats[0] || {
          totalNotifications: 0,
          readNotifications: 0,
          unreadNotifications: 0,
          readRate: 0
        },
        byType: typeStats
      };

      return res.success(result, 'Estadísticas de notificaciones obtenidas');

    } catch (error) {
      logger.error('Error obteniendo estadísticas de notificaciones:', {
        error: error.message,
        stack: error.stack
      });
      return res.serverError('Error obteniendo las estadísticas');
    }
  }
}

module.exports = NotificationController;