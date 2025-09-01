/**
 * Servicio de Notificaciones Push
 * Gestiona el envío de notificaciones push usando Firebase Cloud Messaging (FCM)
 */

const admin = require('firebase-admin');
const logger = require('../utils/logger');
const User = require('../models/User');

class PushService {
  constructor() {
    this.fcm = null;
    this.isInitialized = false;
    
    this.initializeFirebase();
  }

  /**
   * Inicializa Firebase Admin SDK
   */
  initializeFirebase() {
    try {
      // Verificar si ya está inicializado
      if (admin.apps.length > 0) {
        this.fcm = admin.messaging();
        this.isInitialized = true;
        logger.info('Firebase already initialized');
        return;
      }

      // Configuración desde variables de entorno
      let serviceAccount;
      
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        // Desde JSON string en variable de entorno
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        // Desde archivo JSON
        serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      } else {
        // Configuración manual
        serviceAccount = {
          type: 'service_account',
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
        };
      }

      if (!serviceAccount.project_id) {
        logger.warn('Firebase not configured - push notifications will be disabled');
        return;
      }

      // Inicializar Firebase Admin
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });

      this.fcm = admin.messaging();
      this.isInitialized = true;
      
      logger.info('Firebase initialized successfully', {
        projectId: serviceAccount.project_id
      });
    } catch (error) {
      logger.error('Error initializing Firebase:', error.message);
      this.isInitialized = false;
    }
  }

  /**
   * Verifica si el servicio está disponible
   */
  isAvailable() {
    return this.isInitialized && this.fcm !== null;
  }

  /**
   * Envía notificación push a un usuario específico
   */
  async sendToUser(userId, payload, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Push service not available');
    }

    try {
      const user = await User.findById(userId).select('pushTokens');
      
      if (!user || !user.pushTokens || user.pushTokens.length === 0) {
        throw new Error('User has no push tokens registered');
      }

      // Filtrar tokens válidos (no expirados)
      const validTokens = user.pushTokens
        .filter(tokenData => {
          if (tokenData.expiresAt && new Date() > tokenData.expiresAt) {
            return false;
          }
          return tokenData.isActive !== false;
        })
        .map(tokenData => tokenData.token);

      if (validTokens.length === 0) {
        throw new Error('User has no valid push tokens');
      }

      // Preparar mensaje
      const message = this.prepareMessage(payload, options);
      
      // Enviar a múltiples tokens
      const results = await this.sendToTokens(validTokens, message);
      
      // Procesar resultados y limpiar tokens inválidos
      await this.processResults(userId, validTokens, results);
      
      logger.info('Push notification sent to user:', {
        userId,
        tokensCount: validTokens.length,
        successCount: results.successCount,
        failureCount: results.failureCount
      });

      return {
        userId,
        tokensCount: validTokens.length,
        successCount: results.successCount,
        failureCount: results.failureCount,
        messageId: results.responses[0]?.messageId
      };
    } catch (error) {
      logger.error('Error sending push notification to user:', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Envía notificación push a múltiples usuarios
   */
  async sendToUsers(userIds, payload, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Push service not available');
    }

    const results = {
      sent: [],
      failed: []
    };

    const batchSize = options.batchSize || 100;
    
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (userId) => {
        try {
          const result = await this.sendToUser(userId, payload, options);
          results.sent.push({ userId, result });
        } catch (error) {
          results.failed.push({ userId, error: error.message });
        }
      });

      await Promise.allSettled(batchPromises);
      
      // Pequeña pausa entre lotes
      if (i + batchSize < userIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info('Bulk push notifications completed:', {
      total: userIds.length,
      sent: results.sent.length,
      failed: results.failed.length
    });

    return results;
  }

  /**
   * Envía notificación a tokens específicos
   */
  async sendToTokens(tokens, message) {
    if (!this.isAvailable()) {
      throw new Error('Push service not available');
    }

    try {
      if (tokens.length === 1) {
        // Envío individual
        const response = await this.fcm.send({
          ...message,
          token: tokens[0]
        });
        
        return {
          successCount: 1,
          failureCount: 0,
          responses: [{ messageId: response, success: true }]
        };
      } else {
        // Envío múltiple
        const response = await this.fcm.sendMulticast({
          ...message,
          tokens: tokens
        });
        
        return {
          successCount: response.successCount,
          failureCount: response.failureCount,
          responses: response.responses
        };
      }
    } catch (error) {
      logger.error('Error sending to tokens:', {
        tokensCount: tokens.length,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Envía notificación a un tópico
   */
  async sendToTopic(topic, payload, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Push service not available');
    }

    try {
      const message = {
        ...this.prepareMessage(payload, options),
        topic: topic
      };

      const response = await this.fcm.send(message);
      
      logger.info('Push notification sent to topic:', {
        topic,
        messageId: response
      });

      return {
        topic,
        messageId: response
      };
    } catch (error) {
      logger.error('Error sending push notification to topic:', {
        topic,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Suscribe usuarios a un tópico
   */
  async subscribeToTopic(tokens, topic) {
    if (!this.isAvailable()) {
      throw new Error('Push service not available');
    }

    try {
      const response = await this.fcm.subscribeToTopic(tokens, topic);
      
      logger.info('Users subscribed to topic:', {
        topic,
        tokensCount: tokens.length,
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return response;
    } catch (error) {
      logger.error('Error subscribing to topic:', {
        topic,
        tokensCount: tokens.length,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Desuscribe usuarios de un tópico
   */
  async unsubscribeFromTopic(tokens, topic) {
    if (!this.isAvailable()) {
      throw new Error('Push service not available');
    }

    try {
      const response = await this.fcm.unsubscribeFromTopic(tokens, topic);
      
      logger.info('Users unsubscribed from topic:', {
        topic,
        tokensCount: tokens.length,
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return response;
    } catch (error) {
      logger.error('Error unsubscribing from topic:', {
        topic,
        tokensCount: tokens.length,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Prepara el mensaje para FCM
   */
  prepareMessage(payload, options = {}) {
    const message = {
      notification: {
        title: payload.title,
        body: payload.body
      },
      data: {}
    };

    // Agregar datos personalizados
    if (payload.data) {
      // FCM requiere que todos los valores sean strings
      Object.keys(payload.data).forEach(key => {
        message.data[key] = String(payload.data[key]);
      });
    }

    // Configuración para Android
    if (options.android || payload.android) {
      message.android = {
        priority: 'high',
        notification: {
          icon: 'ic_notification',
          color: '#007bff',
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          ...options.android?.notification,
          ...payload.android?.notification
        },
        ...options.android,
        ...payload.android
      };
    }

    // Configuración para iOS
    if (options.apns || payload.apns) {
      message.apns = {
        headers: {
          'apns-priority': '10'
        },
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body
            },
            badge: options.badge || payload.badge || 1,
            sound: 'default',
            'content-available': 1
          }
        },
        ...options.apns,
        ...payload.apns
      };
    }

    // Configuración para Web
    if (options.webpush || payload.webpush) {
      message.webpush = {
        headers: {
          'TTL': '86400' // 24 horas
        },
        notification: {
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          requireInteraction: false,
          ...options.webpush?.notification,
          ...payload.webpush?.notification
        },
        ...options.webpush,
        ...payload.webpush
      };
    }

    return message;
  }

  /**
   * Procesa los resultados del envío y limpia tokens inválidos
   */
  async processResults(userId, tokens, results) {
    const invalidTokens = [];
    
    if (results.responses) {
      results.responses.forEach((response, index) => {
        if (!response.success && response.error) {
          const errorCode = response.error.code;
          
          // Tokens que deben ser removidos
          if (['messaging/invalid-registration-token', 
               'messaging/registration-token-not-registered'].includes(errorCode)) {
            invalidTokens.push(tokens[index]);
          }
        }
      });
    }

    // Remover tokens inválidos del usuario
    if (invalidTokens.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: {
          pushTokens: {
            token: { $in: invalidTokens }
          }
        }
      });

      logger.info('Invalid push tokens removed:', {
        userId,
        removedTokens: invalidTokens.length
      });
    }
  }

  /**
   * Registra un token de push para un usuario
   */
  async registerToken(userId, token, deviceInfo = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verificar si el token ya existe
      const existingTokenIndex = user.pushTokens.findIndex(
        tokenData => tokenData.token === token
      );

      const tokenData = {
        token,
        platform: deviceInfo.platform || 'unknown',
        deviceId: deviceInfo.deviceId,
        appVersion: deviceInfo.appVersion,
        isActive: true,
        registeredAt: new Date(),
        lastUsedAt: new Date()
      };

      if (existingTokenIndex >= 0) {
        // Actualizar token existente
        user.pushTokens[existingTokenIndex] = {
          ...user.pushTokens[existingTokenIndex],
          ...tokenData
        };
      } else {
        // Agregar nuevo token
        user.pushTokens.push(tokenData);
        
        // Limitar a máximo 10 tokens por usuario
        if (user.pushTokens.length > 10) {
          user.pushTokens = user.pushTokens
            .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
            .slice(0, 10);
        }
      }

      await user.save();
      
      logger.info('Push token registered:', {
        userId,
        platform: deviceInfo.platform,
        tokensCount: user.pushTokens.length
      });

      return { success: true, tokensCount: user.pushTokens.length };
    } catch (error) {
      logger.error('Error registering push token:', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Desregistra un token de push
   */
  async unregisterToken(userId, token) {
    try {
      const result = await User.findByIdAndUpdate(
        userId,
        {
          $pull: {
            pushTokens: { token }
          }
        },
        { new: true }
      );

      if (!result) {
        throw new Error('User not found');
      }

      logger.info('Push token unregistered:', {
        userId,
        tokensCount: result.pushTokens.length
      });

      return { success: true, tokensCount: result.pushTokens.length };
    } catch (error) {
      logger.error('Error unregistering push token:', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene estadísticas del servicio
   */
  async getStats() {
    try {
      const stats = await User.aggregate([
        {
          $match: {
            pushTokens: { $exists: true, $ne: [] }
          }
        },
        {
          $project: {
            tokensCount: { $size: '$pushTokens' },
            activeTokensCount: {
              $size: {
                $filter: {
                  input: '$pushTokens',
                  cond: { $eq: ['$$this.isActive', true] }
                }
              }
            },
            platforms: '$pushTokens.platform'
          }
        },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            totalTokens: { $sum: '$tokensCount' },
            totalActiveTokens: { $sum: '$activeTokensCount' },
            platforms: { $push: '$platforms' }
          }
        }
      ]);

      const result = stats[0] || {
        totalUsers: 0,
        totalTokens: 0,
        totalActiveTokens: 0,
        platforms: []
      };

      // Contar plataformas
      const platformCounts = {};
      result.platforms.flat().forEach(platform => {
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
      });

      return {
        isAvailable: this.isAvailable(),
        totalUsers: result.totalUsers,
        totalTokens: result.totalTokens,
        totalActiveTokens: result.totalActiveTokens,
        platformCounts
      };
    } catch (error) {
      logger.error('Error getting push service stats:', error);
      return {
        isAvailable: this.isAvailable(),
        error: error.message
      };
    }
  }
}

module.exports = new PushService();