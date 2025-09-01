const admin = require('firebase-admin');
const twilio = require('twilio');
const logger = require('./logger');
const EmailService = require('../services/EmailService');

/**
 * Servicio de notificaciones unificado
 */
class NotificationService {
  constructor() {
    this.emailService = new EmailService();
    this.twilioClient = null;
    this.firebaseApp = null;
    this.socketIO = null;
    
    this.initializeServices();
  }

  /**
   * Inicializar servicios de notificación
   */
  async initializeServices() {
    try {
      // Inicializar Firebase Admin
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        
        if (!admin.apps.length) {
          this.firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id
          });
        } else {
          this.firebaseApp = admin.app();
        }
        
        logger.info('Firebase Admin inicializado correctamente');
      }

      // Inicializar Twilio
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        this.twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        
        logger.info('Twilio inicializado correctamente');
      }

      // Inicializar servicio de email
      await this.emailService.initialize();
      
    } catch (error) {
      logger.error('Error inicializando servicios de notificación', {
        error: error.message
      });
    }
  }

  /**
   * Configurar Socket.IO para notificaciones en tiempo real
   * @param {Object} io - Instancia de Socket.IO
   */
  setSocketIO(io) {
    this.socketIO = io;
    logger.info('Socket.IO configurado para notificaciones');
  }

  /**
   * Enviar notificación push a dispositivos móviles
   * @param {Array|string} tokens - Token(s) de dispositivo
   * @param {Object} notification - Datos de la notificación
   * @param {Object} data - Datos adicionales
   * @returns {Object} Resultado del envío
   */
  async sendPushNotification(tokens, notification, data = {}) {
    try {
      if (!this.firebaseApp) {
        throw new Error('Firebase no está configurado');
      }

      const tokensArray = Array.isArray(tokens) ? tokens : [tokens];
      const validTokens = tokensArray.filter(token => token && typeof token === 'string');
      
      if (validTokens.length === 0) {
        throw new Error('No hay tokens válidos para enviar');
      }

      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.imageUrl && { imageUrl: notification.imageUrl })
        },
        data: {
          ...data,
          timestamp: Date.now().toString(),
          clickAction: data.clickAction || 'FLUTTER_NOTIFICATION_CLICK'
        },
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#2196F3',
            sound: 'default',
            priority: 'high',
            channelId: data.channelId || 'default'
          },
          data: {
            ...data,
            clickAction: data.clickAction || 'FLUTTER_NOTIFICATION_CLICK'
          }
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body
              },
              badge: data.badge || 1,
              sound: 'default',
              category: data.category || 'GENERAL'
            }
          },
          fcmOptions: {
            imageUrl: notification.imageUrl
          }
        },
        webpush: {
          notification: {
            title: notification.title,
            body: notification.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            ...(notification.imageUrl && { image: notification.imageUrl })
          },
          fcmOptions: {
            link: data.link || '/'
          }
        }
      };

      let result;
      
      if (validTokens.length === 1) {
        // Envío a un solo dispositivo
        result = await admin.messaging().send({
          ...message,
          token: validTokens[0]
        });
        
        logger.info('Notificación push enviada', {
          token: validTokens[0],
          messageId: result,
          title: notification.title
        });
        
        return {
          success: true,
          messageId: result,
          successCount: 1,
          failureCount: 0
        };
        
      } else {
        // Envío múltiple
        result = await admin.messaging().sendMulticast({
          ...message,
          tokens: validTokens
        });
        
        logger.info('Notificaciones push enviadas', {
          successCount: result.successCount,
          failureCount: result.failureCount,
          title: notification.title
        });
        
        // Procesar tokens fallidos
        if (result.failureCount > 0) {
          const failedTokens = [];
          result.responses.forEach((resp, idx) => {
            if (!resp.success) {
              failedTokens.push({
                token: validTokens[idx],
                error: resp.error?.code || 'unknown'
              });
            }
          });
          
          logger.warn('Algunos tokens fallaron', { failedTokens });
        }
        
        return {
          success: result.successCount > 0,
          successCount: result.successCount,
          failureCount: result.failureCount,
          responses: result.responses
        };
      }
      
    } catch (error) {
      logger.error('Error enviando notificación push', {
        error: error.message,
        tokens: Array.isArray(tokens) ? tokens.length : 1,
        title: notification.title
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enviar SMS
   * @param {string} phoneNumber - Número de teléfono
   * @param {string} message - Mensaje
   * @returns {Object} Resultado del envío
   */
  async sendSMS(phoneNumber, message) {
    try {
      if (!this.twilioClient) {
        throw new Error('Twilio no está configurado');
      }

      const result = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      logger.info('SMS enviado', {
        to: phoneNumber,
        sid: result.sid,
        status: result.status
      });

      return {
        success: true,
        sid: result.sid,
        status: result.status
      };
      
    } catch (error) {
      logger.error('Error enviando SMS', {
        phoneNumber,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enviar notificación en tiempo real via Socket.IO
   * @param {string} userId - ID del usuario
   * @param {string} event - Evento
   * @param {Object} data - Datos
   */
  sendRealTimeNotification(userId, event, data) {
    try {
      if (!this.socketIO) {
        logger.warn('Socket.IO no está configurado');
        return;
      }

      // Enviar a usuario específico
      this.socketIO.to(`user_${userId}`).emit(event, {
        ...data,
        timestamp: new Date().toISOString()
      });

      logger.info('Notificación en tiempo real enviada', {
        userId,
        event,
        dataKeys: Object.keys(data)
      });
      
    } catch (error) {
      logger.error('Error enviando notificación en tiempo real', {
        userId,
        event,
        error: error.message
      });
    }
  }

  /**
   * Enviar notificación completa (push, email, tiempo real)
   * @param {Object} user - Usuario destinatario
   * @param {Object} notificationData - Datos de la notificación
   * @returns {Object} Resultado del envío
   */
  async sendCompleteNotification(user, notificationData) {
    const results = {
      push: null,
      email: null,
      realTime: null,
      sms: null
    };

    try {
      const {
        type,
        title,
        body,
        data = {},
        channels = ['push', 'realTime'], // Canales por defecto
        priority = 'normal',
        emailTemplate,
        emailData,
        smsMessage
      } = notificationData;

      // Verificar preferencias del usuario
      const userPreferences = user.notificationPreferences || {};
      const enabledChannels = channels.filter(channel => {
        return userPreferences[channel] !== false;
      });

      // Enviar notificación push
      if (enabledChannels.includes('push') && user.deviceTokens?.length > 0) {
        results.push = await this.sendPushNotification(
          user.deviceTokens,
          { title, body },
          { ...data, type, priority }
        );
      }

      // Enviar email
      if (enabledChannels.includes('email') && user.email && emailTemplate) {
        results.email = await this.emailService.sendEmail(
          user.email,
          title,
          emailTemplate,
          emailData || { user, ...data }
        );
      }

      // Enviar notificación en tiempo real
      if (enabledChannels.includes('realTime')) {
        this.sendRealTimeNotification(user._id.toString(), 'notification', {
          type,
          title,
          body,
          data,
          priority
        });
        results.realTime = { success: true };
      }

      // Enviar SMS (solo para notificaciones críticas)
      if (enabledChannels.includes('sms') && user.phone && smsMessage && priority === 'high') {
        results.sms = await this.sendSMS(user.phone, smsMessage);
      }

      logger.info('Notificación completa enviada', {
        userId: user._id,
        type,
        channels: enabledChannels,
        results: Object.keys(results).filter(key => results[key]?.success)
      });

      return {
        success: true,
        results,
        channelsUsed: enabledChannels
      };
      
    } catch (error) {
      logger.error('Error enviando notificación completa', {
        userId: user._id,
        type: notificationData.type,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message,
        results
      };
    }
  }

  /**
   * Notificaciones específicas del dominio
   */

  /**
   * Notificar nueva solicitud de servicio
   */
  async notifyNewServiceRequest(professional, serviceRequest, client) {
    const notificationData = {
      type: 'new_service_request',
      title: '¡Nueva solicitud de servicio!',
      body: `${client.profile.firstName} solicita ${serviceRequest.service.title}`,
      data: {
        serviceRequestId: serviceRequest._id.toString(),
        clientId: client._id.toString(),
        serviceCategory: serviceRequest.service.category,
        location: serviceRequest.location.address,
        urgency: serviceRequest.urgency
      },
      channels: ['push', 'realTime', 'email'],
      priority: serviceRequest.urgency === 'urgent' ? 'high' : 'normal',
      emailTemplate: 'new-service-request',
      emailData: {
        professional,
        serviceRequest,
        client,
        actionUrl: `${process.env.FRONTEND_URL}/professional/requests/${serviceRequest._id}`
      }
    };

    return await this.sendCompleteNotification(professional, notificationData);
  }

  /**
   * Notificar cotización recibida
   */
  async notifyQuoteReceived(client, serviceRequest, professional, quote) {
    const notificationData = {
      type: 'quote_received',
      title: 'Cotización recibida',
      body: `${professional.businessInfo.businessName} envió una cotización de $${quote.totalCost}`,
      data: {
        serviceRequestId: serviceRequest._id.toString(),
        professionalId: professional._id.toString(),
        quoteId: quote._id.toString(),
        amount: quote.totalCost,
        currency: quote.currency
      },
      channels: ['push', 'realTime', 'email'],
      priority: 'normal',
      emailTemplate: 'quote-received',
      emailData: {
        client,
        serviceRequest,
        professional,
        quote,
        actionUrl: `${process.env.FRONTEND_URL}/client/requests/${serviceRequest._id}/quotes`
      }
    };

    return await this.sendCompleteNotification(client, notificationData);
  }

  /**
   * Notificar servicio confirmado
   */
  async notifyServiceConfirmed(professional, serviceRequest, client) {
    const notifications = [];

    // Notificar al profesional
    const professionalNotification = {
      type: 'service_confirmed',
      title: 'Servicio confirmado',
      body: `${client.profile.firstName} confirmó tu servicio`,
      data: {
        serviceRequestId: serviceRequest._id.toString(),
        clientId: client._id.toString(),
        scheduledDate: serviceRequest.scheduling.preferredDate,
        location: serviceRequest.location.address
      },
      channels: ['push', 'realTime', 'email'],
      priority: 'normal',
      emailTemplate: 'service-confirmed-professional',
      emailData: {
        professional,
        serviceRequest,
        client,
        actionUrl: `${process.env.FRONTEND_URL}/professional/services/${serviceRequest._id}`
      }
    };

    // Notificar al cliente
    const clientNotification = {
      type: 'service_confirmed',
      title: 'Servicio confirmado',
      body: `Tu servicio con ${professional.businessInfo.businessName} está confirmado`,
      data: {
        serviceRequestId: serviceRequest._id.toString(),
        professionalId: professional._id.toString(),
        scheduledDate: serviceRequest.scheduling.preferredDate,
        professionalPhone: professional.profile.phone
      },
      channels: ['push', 'realTime', 'email'],
      priority: 'normal',
      emailTemplate: 'service-confirmed-client',
      emailData: {
        client,
        serviceRequest,
        professional,
        actionUrl: `${process.env.FRONTEND_URL}/client/services/${serviceRequest._id}`
      }
    };

    notifications.push(
      await this.sendCompleteNotification(professional, professionalNotification),
      await this.sendCompleteNotification(client, clientNotification)
    );

    return notifications;
  }

  /**
   * Notificar recordatorio de servicio
   */
  async notifyServiceReminder(user, serviceRequest, hoursUntil) {
    const isClient = user.role === 'client';
    const otherUser = isClient ? serviceRequest.professional : serviceRequest.client;
    
    const notificationData = {
      type: 'service_reminder',
      title: 'Recordatorio de servicio',
      body: `Tu servicio ${isClient ? 'con' : 'para'} ${otherUser.profile.firstName} es en ${hoursUntil} horas`,
      data: {
        serviceRequestId: serviceRequest._id.toString(),
        scheduledDate: serviceRequest.scheduling.preferredDate,
        location: serviceRequest.location.address,
        hoursUntil
      },
      channels: ['push', 'realTime'],
      priority: hoursUntil <= 1 ? 'high' : 'normal'
    };

    return await this.sendCompleteNotification(user, notificationData);
  }

  /**
   * Notificar llegada del profesional
   */
  async notifyProfessionalArrival(client, serviceRequest, professional) {
    const notificationData = {
      type: 'professional_arrived',
      title: 'El profesional ha llegado',
      body: `${professional.businessInfo.businessName} está en tu ubicación`,
      data: {
        serviceRequestId: serviceRequest._id.toString(),
        professionalId: professional._id.toString(),
        professionalPhone: professional.profile.phone,
        location: serviceRequest.location.address
      },
      channels: ['push', 'realTime', 'sms'],
      priority: 'high',
      smsMessage: `${professional.businessInfo.businessName} ha llegado para tu servicio. Tel: ${professional.profile.phone}`
    };

    return await this.sendCompleteNotification(client, notificationData);
  }

  /**
   * Notificar servicio completado
   */
  async notifyServiceCompleted(client, serviceRequest, professional) {
    const notificationData = {
      type: 'service_completed',
      title: 'Servicio completado',
      body: `Tu servicio con ${professional.businessInfo.businessName} ha sido completado`,
      data: {
        serviceRequestId: serviceRequest._id.toString(),
        professionalId: professional._id.toString(),
        completedAt: new Date().toISOString(),
        canReview: true
      },
      channels: ['push', 'realTime', 'email'],
      priority: 'normal',
      emailTemplate: 'service-completed',
      emailData: {
        client,
        serviceRequest,
        professional,
        reviewUrl: `${process.env.FRONTEND_URL}/client/services/${serviceRequest._id}/review`
      }
    };

    return await this.sendCompleteNotification(client, notificationData);
  }

  /**
   * Notificar pago procesado
   */
  async notifyPaymentProcessed(user, serviceRequest, payment) {
    const isClient = user.role === 'client';
    
    const notificationData = {
      type: 'payment_processed',
      title: isClient ? 'Pago procesado' : 'Pago recibido',
      body: isClient 
        ? `Tu pago de $${payment.amount} ha sido procesado`
        : `Has recibido un pago de $${payment.amount}`,
      data: {
        serviceRequestId: serviceRequest._id.toString(),
        paymentId: payment._id.toString(),
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method
      },
      channels: ['push', 'realTime', 'email'],
      priority: 'normal',
      emailTemplate: isClient ? 'payment-processed-client' : 'payment-received-professional',
      emailData: {
        user,
        serviceRequest,
        payment,
        receiptUrl: `${process.env.FRONTEND_URL}/payments/${payment._id}/receipt`
      }
    };

    return await this.sendCompleteNotification(user, notificationData);
  }

  /**
   * Limpiar tokens de dispositivo inválidos
   * @param {Array} invalidTokens - Tokens inválidos
   */
  async cleanupInvalidTokens(invalidTokens) {
    try {
      if (!Array.isArray(invalidTokens) || invalidTokens.length === 0) {
        return;
      }

      // Aquí deberías implementar la lógica para remover los tokens
      // de la base de datos de usuarios
      logger.info('Limpiando tokens inválidos', {
        count: invalidTokens.length,
        tokens: invalidTokens
      });
      
    } catch (error) {
      logger.error('Error limpiando tokens inválidos', {
        error: error.message
      });
    }
  }

  /**
   * Obtener estadísticas de notificaciones
   */
  getStats() {
    return {
      firebaseConfigured: !!this.firebaseApp,
      twilioConfigured: !!this.twilioClient,
      emailConfigured: this.emailService.isConfigured(),
      socketIOConfigured: !!this.socketIO
    };
  }
}

// Instancia singleton
const notificationService = new NotificationService();

module.exports = {
  NotificationService,
  notificationService
};