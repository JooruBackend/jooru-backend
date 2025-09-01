/**
 * Rutas para gestión de notificaciones
 * Maneja endpoints para notificaciones del sistema
 */

const express = require('express');
const NotificationController = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/authenticate');
const responseMiddleware = require('../middleware/responseMiddleware');
const { createUserRateLimit } = require('../middleware/rateLimitByUser');

const router = express.Router();

// Aplicar middleware de respuesta a todas las rutas
router.use(responseMiddleware);

// Rate limiting para notificaciones
const notificationRateLimit = createUserRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: 'Demasiadas solicitudes de notificaciones. Intenta de nuevo en 15 minutos.',
  keyGenerator: (req) => {
    return req.user ? `notification_${req.user.id}` : `notification_ip_${req.ip}`;
  }
});

const testNotificationRateLimit = createUserRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // máximo 5 notificaciones de prueba por hora
  message: 'Demasiadas notificaciones de prueba enviadas. Intenta de nuevo en 1 hora.',
  keyGenerator: (req) => {
    return req.user ? `test_notification_${req.user.id}` : `test_notification_ip_${req.ip}`;
  }
});

// ============================================================================
// RUTAS PARA USUARIOS AUTENTICADOS
// ============================================================================

/**
 * @route   GET /api/notifications
 * @desc    Obtener notificaciones del usuario
 * @access  Private
 * @query   {
 *            page: Number,
 *            limit: Number,
 *            type: String,
 *            isRead: Boolean,
 *            sortBy: String,
 *            sortOrder: String
 *          }
 */
router.get(
  '/',
  authenticate,
  notificationRateLimit,
  NotificationController.getUserNotifications
);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Obtener conteo de notificaciones no leídas
 * @access  Private
 */
router.get(
  '/unread-count',
  authenticate,
  NotificationController.getUnreadCount
);

/**
 * @route   PUT /api/notifications/:notificationId/read
 * @desc    Marcar notificación como leída
 * @access  Private
 * @params  notificationId - ID de la notificación
 */
router.put(
  '/:notificationId/read',
  authenticate,
  NotificationController.markAsRead
);

/**
 * @route   PUT /api/notifications/mark-all-read
 * @desc    Marcar todas las notificaciones como leídas
 * @access  Private
 */
router.put(
  '/mark-all-read',
  authenticate,
  NotificationController.markAllAsRead
);

/**
 * @route   DELETE /api/notifications/:notificationId
 * @desc    Eliminar una notificación
 * @access  Private
 * @params  notificationId - ID de la notificación
 */
router.delete(
  '/:notificationId',
  authenticate,
  NotificationController.deleteNotification
);

/**
 * @route   DELETE /api/notifications/read
 * @desc    Eliminar todas las notificaciones leídas
 * @access  Private
 */
router.delete(
  '/read',
  authenticate,
  NotificationController.deleteReadNotifications
);

// ============================================================================
// RUTAS PARA CONFIGURACIÓN DE NOTIFICACIONES
// ============================================================================

/**
 * @route   GET /api/notifications/settings
 * @desc    Obtener configuración de notificaciones del usuario
 * @access  Private
 */
router.get(
  '/settings',
  authenticate,
  NotificationController.getNotificationSettings
);

/**
 * @route   PUT /api/notifications/settings
 * @desc    Actualizar configuración de notificaciones del usuario
 * @access  Private
 * @body    {
 *            email: {
 *              newQuote: Boolean,
 *              quoteAccepted: Boolean,
 *              quoteRejected: Boolean,
 *              serviceCompleted: Boolean,
 *              newMessage: Boolean,
 *              paymentReceived: Boolean,
 *              systemUpdates: Boolean
 *            },
 *            push: { ... },
 *            sms: { ... }
 *          }
 */
router.put(
  '/settings',
  authenticate,
  NotificationController.updateNotificationSettings
);

/**
 * @route   POST /api/notifications/test
 * @desc    Enviar notificación de prueba
 * @access  Private
 * @body    {
 *            type: String,
 *            channel: String (email|push|sms)
 *          }
 */
router.post(
  '/test',
  authenticate,
  testNotificationRateLimit,
  NotificationController.sendTestNotification
);

// ============================================================================
// RUTAS PARA ADMINISTRADORES
// ============================================================================

/**
 * @route   GET /api/notifications/admin/stats
 * @desc    Obtener estadísticas de notificaciones del sistema
 * @access  Private (Admin)
 * @query   {
 *            startDate: Date,
 *            endDate: Date
 *          }
 */
router.get(
  '/admin/stats',
  authenticate,
  authorize(['admin']),
  NotificationController.getNotificationStats
);

/**
 * @route   POST /api/notifications/admin/broadcast
 * @desc    Enviar notificación masiva a usuarios
 * @access  Private (Admin)
 * @body    {
 *            title: String,
 *            message: String,
 *            type: String,
 *            targetUsers: [String], // IDs de usuarios específicos (opcional)
 *            targetRoles: [String], // Roles específicos (opcional)
 *            channels: [String] // Canales de envío
 *          }
 */
router.post(
  '/admin/broadcast',
  authenticate,
  authorize(['admin']),
  async (req, res, next) => {
    try {
      const {
        title,
        message,
        type = 'system',
        targetUsers,
        targetRoles,
        channels = ['push']
      } = req.body;

      // Validaciones básicas
      if (!title || !message) {
        return res.validationError([{
          field: 'title',
          message: 'El título y mensaje son requeridos'
        }]);
      }

      const User = require('../models/User');
      const Notification = require('../models/Notification');
      const { NotificationService } = require('../utils/notifications');
      const logger = require('../utils/logger');

      // Determinar usuarios objetivo
      let targetQuery = {};
      
      if (targetUsers && targetUsers.length > 0) {
        targetQuery._id = { $in: targetUsers };
      } else if (targetRoles && targetRoles.length > 0) {
        targetQuery.role = { $in: targetRoles };
      }

      // Solo usuarios activos
      targetQuery.status = 'active';

      const users = await User.find(targetQuery).select('_id email phone notificationSettings');

      if (users.length === 0) {
        return res.error('No se encontraron usuarios objetivo', 400);
      }

      // Crear notificaciones en lote
      const notifications = users.map(user => ({
        recipient: user._id,
        type,
        title,
        message,
        data: {
          broadcast: true,
          sentBy: req.userId,
          sentAt: new Date()
        }
      }));

      await Notification.insertMany(notifications);

      // Enviar notificaciones según canales especificados
      let sentCount = 0;
      let errorCount = 0;

      for (const user of users) {
        for (const channel of channels) {
          try {
            switch (channel) {
              case 'email':
                if (user.email && user.notificationSettings?.email?.systemUpdates !== false) {
                  await NotificationService.sendEmailNotification(
                    user._id,
                    title,
                    message
                  );
                  sentCount++;
                }
                break;
              case 'push':
                if (user.notificationSettings?.push?.systemUpdates !== false) {
                  await NotificationService.sendPushNotification(
                    user._id,
                    title,
                    message,
                    { broadcast: true }
                  );
                  sentCount++;
                }
                break;
              case 'sms':
                if (user.phone && user.notificationSettings?.sms?.systemUpdates !== false) {
                  await NotificationService.sendSMSNotification(
                    user._id,
                    message
                  );
                  sentCount++;
                }
                break;
            }
          } catch (sendError) {
            errorCount++;
            logger.warn('Error enviando notificación broadcast:', {
              error: sendError.message,
              userId: user._id,
              channel
            });
          }
        }
      }

      logger.info('Notificación broadcast enviada:', {
        adminId: req.userId,
        targetUsers: users.length,
        sentCount,
        errorCount,
        channels,
        type
      });

      return res.success({
        targetUsers: users.length,
        notificationsCreated: notifications.length,
        sentCount,
        errorCount,
        channels
      }, 'Notificación masiva enviada exitosamente');

    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error enviando notificación broadcast:', {
        error: error.message,
        stack: error.stack,
        adminId: req.userId
      });
      return res.serverError('Error enviando la notificación masiva');
    }
  }
);

// ============================================================================
// RUTAS PARA WEBHOOKS Y EVENTOS EXTERNOS
// ============================================================================

/**
 * @route   POST /api/notifications/webhook/push-delivery
 * @desc    Webhook para confirmación de entrega de notificaciones push
 * @access  Public (con validación de webhook)
 * @body    {
 *            notificationId: String,
 *            userId: String,
 *            status: String,
 *            timestamp: Date,
 *            deviceInfo: Object
 *          }
 */
router.post(
  '/webhook/push-delivery',
  async (req, res, next) => {
    try {
      const {
        notificationId,
        userId,
        status,
        timestamp,
        deviceInfo
      } = req.body;

      // Validar webhook signature si está configurada
      const webhookSecret = process.env.PUSH_WEBHOOK_SECRET;
      if (webhookSecret) {
        const signature = req.headers['x-webhook-signature'];
        const crypto = require('crypto');
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(JSON.stringify(req.body))
          .digest('hex');
        
        if (signature !== `sha256=${expectedSignature}`) {
          return res.status(401).json({ error: 'Invalid webhook signature' });
        }
      }

      const Notification = require('../models/Notification');
      const logger = require('../utils/logger');

      // Actualizar estado de entrega de la notificación
      if (notificationId) {
        await Notification.findByIdAndUpdate(notificationId, {
          $set: {
            'deliveryStatus.push': {
              status,
              timestamp: new Date(timestamp),
              deviceInfo
            }
          }
        });
      }

      logger.info('Webhook de entrega de notificación push recibido:', {
        notificationId,
        userId,
        status,
        timestamp
      });

      return res.status(200).json({ received: true });

    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error procesando webhook de notificación push:', {
        error: error.message,
        stack: error.stack,
        body: req.body
      });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;