/**
 * Servicio de Notificaciones
 * Gestiona el envío de notificaciones push, email y SMS
 */

const Notification = require('../models/Notification');
const User = require('../models/User');
const logger = require('../utils/logger');
const emailService = require('./EmailService');
const smsService = require('./SMSService');
const pushService = require('./PushService');

class NotificationService {
  constructor() {
    this.templates = {
      // Notificaciones de servicios
      SERVICE_REQUEST_CREATED: {
        title: 'Nueva solicitud de servicio',
        body: 'Has recibido una nueva solicitud de servicio',
        type: 'service_request',
        priority: 'high'
      },
      SERVICE_REQUEST_ACCEPTED: {
        title: 'Solicitud aceptada',
        body: 'Tu solicitud de servicio ha sido aceptada',
        type: 'service_request',
        priority: 'high'
      },
      SERVICE_REQUEST_REJECTED: {
        title: 'Solicitud rechazada',
        body: 'Tu solicitud de servicio ha sido rechazada',
        type: 'service_request',
        priority: 'medium'
      },
      SERVICE_REQUEST_COMPLETED: {
        title: 'Servicio completado',
        body: 'El servicio ha sido marcado como completado',
        type: 'service_request',
        priority: 'high'
      },
      SERVICE_REQUEST_CANCELLED: {
        title: 'Servicio cancelado',
        body: 'El servicio ha sido cancelado',
        type: 'service_request',
        priority: 'medium'
      },
      
      // Notificaciones de pagos
      PAYMENT_PROCESSED: {
        title: 'Pago procesado',
        body: 'Tu pago ha sido procesado exitosamente',
        type: 'payment',
        priority: 'high'
      },
      PAYMENT_FAILED: {
        title: 'Error en el pago',
        body: 'No se pudo procesar tu pago',
        type: 'payment',
        priority: 'high'
      },
      PAYMENT_REFUNDED: {
        title: 'Reembolso procesado',
        body: 'Tu reembolso ha sido procesado',
        type: 'payment',
        priority: 'medium'
      },
      INVOICE_GENERATED: {
        title: 'Factura generada',
        body: 'Se ha generado tu factura',
        type: 'invoice',
        priority: 'medium'
      },
      
      // Notificaciones de chat
      NEW_MESSAGE: {
        title: 'Nuevo mensaje',
        body: 'Has recibido un nuevo mensaje',
        type: 'message',
        priority: 'medium'
      },
      
      // Notificaciones de calificaciones
      NEW_REVIEW: {
        title: 'Nueva calificación',
        body: 'Has recibido una nueva calificación',
        type: 'review',
        priority: 'medium'
      },
      
      // Notificaciones del sistema
      ACCOUNT_VERIFIED: {
        title: 'Cuenta verificada',
        body: 'Tu cuenta ha sido verificada exitosamente',
        type: 'system',
        priority: 'medium'
      },
      PROFILE_UPDATED: {
        title: 'Perfil actualizado',
        body: 'Tu perfil ha sido actualizado',
        type: 'system',
        priority: 'low'
      },
      SUBSCRIPTION_EXPIRED: {
        title: 'Suscripción expirada',
        body: 'Tu suscripción ha expirado',
        type: 'subscription',
        priority: 'high'
      },
      SUBSCRIPTION_RENEWED: {
        title: 'Suscripción renovada',
        body: 'Tu suscripción ha sido renovada',
        type: 'subscription',
        priority: 'medium'
      },
      
      // Notificaciones promocionales
      PROMOTION_AVAILABLE: {
        title: 'Promoción disponible',
        body: 'Tienes una nueva promoción disponible',
        type: 'promotion',
        priority: 'low'
      },
      
      // Notificaciones de seguridad
      LOGIN_DETECTED: {
        title: 'Nuevo inicio de sesión',
        body: 'Se detectó un nuevo inicio de sesión en tu cuenta',
        type: 'security',
        priority: 'high'
      },
      PASSWORD_CHANGED: {
        title: 'Contraseña cambiada',
        body: 'Tu contraseña ha sido cambiada',
        type: 'security',
        priority: 'high'
      }
    };
  }

  /**
   * Envía una notificación a un usuario
   */
  async sendNotification(userId, templateKey, data = {}, options = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Usuario no encontrado');
      }

      const template = this.templates[templateKey];
      if (!template) {
        throw new Error(`Template de notificación no encontrado: ${templateKey}`);
      }

      // Verificar preferencias del usuario
      const userPreferences = user.notificationSettings || {};
      if (!this.shouldSendNotification(template.type, userPreferences)) {
        logger.info('Notificación omitida por preferencias del usuario', {
          userId,
          templateKey,
          type: template.type
        });
        return null;
      }

      // Personalizar el contenido con los datos proporcionados
      const title = this.interpolateTemplate(template.title, data);
      const body = this.interpolateTemplate(template.body, data);

      // Crear la notificación en la base de datos
      const notification = new Notification({
        user: userId,
        title,
        body,
        type: template.type,
        priority: template.priority,
        data: data,
        channels: options.channels || ['push', 'in_app'],
        metadata: options.metadata || {}
      });

      await notification.save();

      // Enviar por los canales especificados
      await this.sendThroughChannels(notification, user, options);

      logger.info('Notificación enviada exitosamente', {
        notificationId: notification._id,
        userId,
        templateKey,
        channels: notification.channels
      });

      return notification;
    } catch (error) {
      logger.error('Error enviando notificación:', {
        userId,
        templateKey,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Envía notificaciones masivas
   */
  async sendBulkNotification(userIds, templateKey, data = {}, options = {}) {
    const results = {
      sent: [],
      failed: []
    };

    for (const userId of userIds) {
      try {
        const notification = await this.sendNotification(userId, templateKey, data, options);
        if (notification) {
          results.sent.push({ userId, notificationId: notification._id });
        }
      } catch (error) {
        results.failed.push({ userId, error: error.message });
      }
    }

    logger.info('Notificación masiva completada', {
      templateKey,
      totalUsers: userIds.length,
      sent: results.sent.length,
      failed: results.failed.length
    });

    return results;
  }

  /**
   * Envía notificación a todos los usuarios con un rol específico
   */
  async sendNotificationToRole(role, templateKey, data = {}, options = {}) {
    try {
      const users = await User.find({ role, isActive: true }).select('_id');
      const userIds = users.map(user => user._id);
      
      return await this.sendBulkNotification(userIds, templateKey, data, options);
    } catch (error) {
      logger.error('Error enviando notificación por rol:', {
        role,
        templateKey,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Envía notificación broadcast a todos los usuarios activos
   */
  async sendBroadcastNotification(templateKey, data = {}, options = {}) {
    try {
      const users = await User.find({ isActive: true }).select('_id');
      const userIds = users.map(user => user._id);
      
      return await this.sendBulkNotification(userIds, templateKey, data, options);
    } catch (error) {
      logger.error('Error enviando notificación broadcast:', {
        templateKey,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Envía la notificación a través de los canales especificados
   */
  async sendThroughChannels(notification, user, options = {}) {
    const promises = [];

    for (const channel of notification.channels) {
      switch (channel) {
        case 'push':
          if (user.pushTokens && user.pushTokens.length > 0) {
            promises.push(this.sendPushNotification(notification, user));
          }
          break;
        
        case 'email':
          if (user.email && user.notificationSettings?.email !== false) {
            promises.push(this.sendEmailNotification(notification, user));
          }
          break;
        
        case 'sms':
          if (user.phone && user.notificationSettings?.sms !== false) {
            promises.push(this.sendSMSNotification(notification, user));
          }
          break;
        
        case 'in_app':
          // Las notificaciones in-app se guardan en la base de datos automáticamente
          break;
      }
    }

    // Ejecutar todos los envíos en paralelo
    const results = await Promise.allSettled(promises);
    
    // Actualizar el estado de entrega
    const deliveryStatus = {};
    notification.channels.forEach((channel, index) => {
      if (channel !== 'in_app') {
        const result = results[index];
        deliveryStatus[channel] = {
          status: result.status === 'fulfilled' ? 'sent' : 'failed',
          sentAt: result.status === 'fulfilled' ? new Date() : null,
          error: result.status === 'rejected' ? result.reason.message : null
        };
      } else {
        deliveryStatus[channel] = {
          status: 'sent',
          sentAt: new Date()
        };
      }
    });

    notification.deliveryStatus = deliveryStatus;
    await notification.save();
  }

  /**
   * Envía notificación push
   */
  async sendPushNotification(notification, user) {
    try {
      const payload = {
        title: notification.title,
        body: notification.body,
        data: {
          notificationId: notification._id.toString(),
          type: notification.type,
          ...notification.data
        }
      };

      await pushService.sendToUser(user._id, payload);
      
      logger.info('Push notification enviada', {
        userId: user._id,
        notificationId: notification._id
      });
    } catch (error) {
      logger.error('Error enviando push notification:', {
        userId: user._id,
        notificationId: notification._id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Envía notificación por email
   */
  async sendEmailNotification(notification, user) {
    try {
      const emailData = {
        to: user.email,
        subject: notification.title,
        template: `notification_${notification.type}`,
        data: {
          userName: user.firstName || user.name,
          title: notification.title,
          body: notification.body,
          ...notification.data
        }
      };

      await emailService.sendEmail(emailData);
      
      logger.info('Email notification enviada', {
        userId: user._id,
        notificationId: notification._id,
        email: user.email
      });
    } catch (error) {
      logger.error('Error enviando email notification:', {
        userId: user._id,
        notificationId: notification._id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Envía notificación por SMS
   */
  async sendSMSNotification(notification, user) {
    try {
      const message = `${notification.title}: ${notification.body}`;
      
      await smsService.sendSMS(user.phone, message);
      
      logger.info('SMS notification enviada', {
        userId: user._id,
        notificationId: notification._id,
        phone: user.phone
      });
    } catch (error) {
      logger.error('Error enviando SMS notification:', {
        userId: user._id,
        notificationId: notification._id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verifica si se debe enviar la notificación según las preferencias del usuario
   */
  shouldSendNotification(type, userPreferences) {
    // Si no hay preferencias, enviar por defecto
    if (!userPreferences) return true;
    
    // Verificar si el tipo está habilitado
    if (userPreferences.types && userPreferences.types[type] === false) {
      return false;
    }
    
    // Verificar horario de no molestar
    if (userPreferences.doNotDisturb) {
      const now = new Date();
      const currentHour = now.getHours();
      const startHour = userPreferences.doNotDisturb.startHour || 22;
      const endHour = userPreferences.doNotDisturb.endHour || 7;
      
      if (startHour > endHour) {
        // Horario que cruza medianoche (ej: 22:00 - 07:00)
        if (currentHour >= startHour || currentHour < endHour) {
          return false;
        }
      } else {
        // Horario normal (ej: 13:00 - 15:00)
        if (currentHour >= startHour && currentHour < endHour) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Interpola variables en el template
   */
  interpolateTemplate(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  /**
   * Marca una notificación como leída
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, user: userId },
        { 
          isRead: true,
          readAt: new Date()
        },
        { new: true }
      );

      if (!notification) {
        throw new Error('Notificación no encontrada');
      }

      return notification;
    } catch (error) {
      logger.error('Error marcando notificación como leída:', {
        notificationId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Marca todas las notificaciones de un usuario como leídas
   */
  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { user: userId, isRead: false },
        { 
          isRead: true,
          readAt: new Date()
        }
      );

      logger.info('Todas las notificaciones marcadas como leídas', {
        userId,
        count: result.modifiedCount
      });

      return result;
    } catch (error) {
      logger.error('Error marcando todas las notificaciones como leídas:', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de notificaciones
   */
  async getStats(filters = {}) {
    try {
      const pipeline = [];
      
      // Filtros
      const matchStage = {};
      if (filters.startDate || filters.endDate) {
        matchStage.createdAt = {};
        if (filters.startDate) matchStage.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) matchStage.createdAt.$lte = new Date(filters.endDate);
      }
      if (filters.type) matchStage.type = filters.type;
      if (filters.priority) matchStage.priority = filters.priority;
      
      if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
      }
      
      // Estadísticas generales
      pipeline.push({
        $group: {
          _id: null,
          total: { $sum: 1 },
          read: { $sum: { $cond: ['$isRead', 1, 0] } },
          unread: { $sum: { $cond: ['$isRead', 0, 1] } },
          byType: {
            $push: {
              type: '$type',
              priority: '$priority',
              isRead: '$isRead'
            }
          }
        }
      });
      
      const [stats] = await Notification.aggregate(pipeline);
      
      if (!stats) {
        return {
          total: 0,
          read: 0,
          unread: 0,
          byType: {},
          byPriority: {},
          readRate: 0
        };
      }
      
      // Procesar estadísticas por tipo y prioridad
      const byType = {};
      const byPriority = {};
      
      stats.byType.forEach(item => {
        // Por tipo
        if (!byType[item.type]) {
          byType[item.type] = { total: 0, read: 0, unread: 0 };
        }
        byType[item.type].total++;
        if (item.isRead) {
          byType[item.type].read++;
        } else {
          byType[item.type].unread++;
        }
        
        // Por prioridad
        if (!byPriority[item.priority]) {
          byPriority[item.priority] = { total: 0, read: 0, unread: 0 };
        }
        byPriority[item.priority].total++;
        if (item.isRead) {
          byPriority[item.priority].read++;
        } else {
          byPriority[item.priority].unread++;
        }
      });
      
      return {
        total: stats.total,
        read: stats.read,
        unread: stats.unread,
        byType,
        byPriority,
        readRate: stats.total > 0 ? (stats.read / stats.total * 100).toFixed(2) : 0
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas de notificaciones:', {
        filters,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new NotificationService();