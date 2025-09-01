/**
 * Rutas para gestión de pagos y facturación
 * Maneja endpoints para procesamiento de pagos, reembolsos y facturación
 */

const express = require('express');
const PaymentController = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/authenticate');
const responseMiddleware = require('../middleware/responseMiddleware');
const { createUserRateLimit } = require('../middleware/rateLimitByUser');

const router = express.Router();

// Aplicar middleware de respuesta a todas las rutas excepto webhooks
router.use((req, res, next) => {
  if (req.path.startsWith('/webhook')) {
    return next();
  }
  responseMiddleware(req, res, next);
});

// Rate limiting para pagos
const paymentRateLimit = createUserRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos de pago por ventana
  message: 'Demasiados intentos de pago. Intenta de nuevo en 15 minutos.',
  keyGenerator: (req) => {
    return req.user ? `payment_${req.user.id}` : `payment_ip_${req.ip}`;
  }
});

const refundRateLimit = createUserRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // máximo 5 solicitudes de reembolso por hora
  message: 'Demasiadas solicitudes de reembolso. Intenta de nuevo en 1 hora.',
  keyGenerator: (req) => {
    return req.user ? `refund_${req.user.id}` : `refund_ip_${req.ip}`;
  }
});

// ============================================================================
// RUTAS PARA PROCESAMIENTO DE PAGOS
// ============================================================================

/**
 * @route   POST /api/payments/service-requests/:serviceRequestId/pay
 * @desc    Procesar pago de un servicio
 * @access  Private (Clientes)
 * @params  serviceRequestId - ID de la solicitud de servicio
 * @body    {
 *            paymentMethod: {
 *              type: String (required), // 'card', 'bank_transfer', 'digital_wallet'
 *              cardToken: String, // Para pagos con tarjeta
 *              bankAccount: Object, // Para transferencias bancarias
 *              walletProvider: String // Para billeteras digitales
 *            },
 *            currency: String, // Opcional, por defecto 'COP'
 *            savePaymentMethod: Boolean // Guardar método de pago para futuros usos
 *          }
 */
router.post(
  '/service-requests/:serviceRequestId/pay',
  authenticate,
  authorize(['client']),
  paymentRateLimit,
  PaymentController.processPayment
);

/**
 * @route   GET /api/payments/history
 * @desc    Obtener historial de pagos del usuario
 * @access  Private (Clientes y Profesionales)
 * @query   {
 *            page: Number,
 *            limit: Number,
 *            status: String,
 *            startDate: Date,
 *            endDate: Date,
 *            sortBy: String,
 *            sortOrder: String
 *          }
 */
router.get(
  '/history',
  authenticate,
  authorize(['client', 'professional']),
  PaymentController.getPaymentHistory
);

/**
 * @route   GET /api/payments/:paymentId
 * @desc    Obtener detalles de un pago específico
 * @access  Private (Cliente propietario, Profesional asignado, o Admin)
 * @params  paymentId - ID del pago
 */
router.get(
  '/:paymentId',
  authenticate,
  PaymentController.getPaymentDetails
);

/**
 * @route   GET /api/payments/stats
 * @desc    Obtener estadísticas de pagos
 * @access  Private (Usuarios autenticados)
 * @query   {
 *            startDate: Date,
 *            endDate: Date
 *          }
 */
router.get(
  '/stats',
  authenticate,
  PaymentController.getPaymentStats
);

// ============================================================================
// RUTAS PARA REEMBOLSOS
// ============================================================================

/**
 * @route   POST /api/payments/:paymentId/refund
 * @desc    Procesar reembolso de un pago
 * @access  Private (Admin o casos específicos)
 * @params  paymentId - ID del pago
 * @body    {
 *            reason: String (required),
 *            amount: Number // Opcional, por defecto el monto total
 *          }
 */
router.post(
  '/:paymentId/refund',
  authenticate,
  refundRateLimit,
  PaymentController.processRefund
);

// ============================================================================
// RUTAS PARA MÉTODOS DE PAGO
// ============================================================================

/**
 * @route   GET /api/payments/methods
 * @desc    Obtener métodos de pago guardados del usuario
 * @access  Private (Clientes)
 */
router.get(
  '/methods',
  authenticate,
  authorize(['client']),
  async (req, res, next) => {
    try {
      const { PaymentService } = require('../utils/payments');
      
      const paymentMethods = await PaymentService.getUserPaymentMethods(req.userId);
      
      return res.success(paymentMethods, 'Métodos de pago obtenidos exitosamente');
      
    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error obteniendo métodos de pago:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId
      });
      return res.serverError('Error obteniendo los métodos de pago');
    }
  }
);

/**
 * @route   POST /api/payments/methods
 * @desc    Agregar nuevo método de pago
 * @access  Private (Clientes)
 * @body    {
 *            type: String (required),
 *            cardToken: String,
 *            bankAccount: Object,
 *            isDefault: Boolean
 *          }
 */
router.post(
  '/methods',
  authenticate,
  authorize(['client']),
  async (req, res, next) => {
    try {
      const { type, cardToken, bankAccount, isDefault } = req.body;
      
      if (!type) {
        return res.validationError([{
          field: 'type',
          message: 'El tipo de método de pago es requerido'
        }]);
      }
      
      const { PaymentService } = require('../utils/payments');
      const logger = require('../utils/logger');
      
      const paymentMethod = await PaymentService.addPaymentMethod({
        userId: req.userId,
        type,
        cardToken,
        bankAccount,
        isDefault
      });
      
      logger.info('Método de pago agregado:', {
        userId: req.userId,
        type,
        paymentMethodId: paymentMethod.id
      });
      
      return res.success(paymentMethod, 'Método de pago agregado exitosamente', 201);
      
    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error agregando método de pago:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId
      });
      return res.serverError('Error agregando el método de pago');
    }
  }
);

/**
 * @route   DELETE /api/payments/methods/:methodId
 * @desc    Eliminar método de pago
 * @access  Private (Clientes)
 * @params  methodId - ID del método de pago
 */
router.delete(
  '/methods/:methodId',
  authenticate,
  authorize(['client']),
  async (req, res, next) => {
    try {
      const { methodId } = req.params;
      
      const { PaymentService } = require('../utils/payments');
      const logger = require('../utils/logger');
      
      await PaymentService.removePaymentMethod(req.userId, methodId);
      
      logger.info('Método de pago eliminado:', {
        userId: req.userId,
        methodId
      });
      
      return res.success(null, 'Método de pago eliminado exitosamente');
      
    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error eliminando método de pago:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId,
        methodId: req.params.methodId
      });
      return res.serverError('Error eliminando el método de pago');
    }
  }
);

// ============================================================================
// RUTAS PARA FACTURAS
// ============================================================================

/**
 * @route   GET /api/payments/invoices
 * @desc    Obtener facturas del usuario
 * @access  Private (Clientes y Profesionales)
 * @query   {
 *            page: Number,
 *            limit: Number,
 *            status: String,
 *            startDate: Date,
 *            endDate: Date
 *          }
 */
router.get(
  '/invoices',
  authenticate,
  authorize(['client', 'professional']),
  async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const query = {};

      // Filtrar por rol del usuario
      if (req.userRole === 'client') {
        query.client = req.userId;
      } else if (req.userRole === 'professional') {
        query.professional = req.user.professional;
      }

      // Filtros opcionales
      if (status) {
        query.status = status;
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      // Configurar ordenamiento
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const Invoice = require('../models/Invoice');
      
      // Buscar facturas
      const invoices = await Invoice.find(query)
        .populate('payment', 'status totalAmount paymentMethod')
        .populate('serviceRequest', 'title category')
        .populate('client', 'firstName lastName email')
        .populate('professional', 'businessName')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Invoice.countDocuments(query);

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasNext: skip + parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      };

      return res.paginated(invoices, pagination, 'Facturas obtenidas exitosamente');

    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error obteniendo facturas:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId
      });
      return res.serverError('Error obteniendo las facturas');
    }
  }
);

/**
 * @route   GET /api/payments/invoices/:invoiceId
 * @desc    Obtener detalles de una factura específica
 * @access  Private (Cliente propietario, Profesional asignado, o Admin)
 * @params  invoiceId - ID de la factura
 */
router.get(
  '/invoices/:invoiceId',
  authenticate,
  async (req, res, next) => {
    try {
      const { invoiceId } = req.params;
      
      const Invoice = require('../models/Invoice');
      
      const invoice = await Invoice.findById(invoiceId)
        .populate('payment')
        .populate('serviceRequest', 'title description category')
        .populate('client', 'firstName lastName email address')
        .populate('professional', 'businessName taxId address');

      if (!invoice) {
        return res.notFound('Factura no encontrada');
      }

      // Verificar permisos de acceso
      const isClient = req.userRole === 'client' && invoice.client._id.toString() === req.userId;
      const isProfessional = req.userRole === 'professional' && 
        invoice.professional._id.toString() === req.user.professional.toString();
      const isAdmin = req.userRole === 'admin';

      if (!isClient && !isProfessional && !isAdmin) {
        return res.forbidden('No tienes permisos para ver esta factura');
      }

      return res.success(invoice, 'Detalles de la factura obtenidos exitosamente');

    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error obteniendo detalles de la factura:', {
        error: error.message,
        stack: error.stack,
        invoiceId: req.params.invoiceId,
        userId: req.userId
      });
      return res.serverError('Error obteniendo los detalles de la factura');
    }
  }
);

/**
 * @route   GET /api/payments/invoices/:invoiceId/download
 * @desc    Descargar factura en PDF
 * @access  Private (Cliente propietario, Profesional asignado, o Admin)
 * @params  invoiceId - ID de la factura
 */
router.get(
  '/invoices/:invoiceId/download',
  authenticate,
  async (req, res, next) => {
    try {
      const { invoiceId } = req.params;
      
      const Invoice = require('../models/Invoice');
      const { PDFService } = require('../utils/pdf');
      
      const invoice = await Invoice.findById(invoiceId)
        .populate('payment')
        .populate('serviceRequest')
        .populate('client')
        .populate('professional');

      if (!invoice) {
        return res.notFound('Factura no encontrada');
      }

      // Verificar permisos de acceso
      const isClient = req.userRole === 'client' && invoice.client._id.toString() === req.userId;
      const isProfessional = req.userRole === 'professional' && 
        invoice.professional._id.toString() === req.user.professional.toString();
      const isAdmin = req.userRole === 'admin';

      if (!isClient && !isProfessional && !isAdmin) {
        return res.forbidden('No tienes permisos para descargar esta factura');
      }

      // Generar PDF
      const pdfBuffer = await PDFService.generateInvoicePDF(invoice);
      
      // Configurar headers para descarga
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="factura-${invoice.invoiceNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      return res.send(pdfBuffer);

    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error descargando factura:', {
        error: error.message,
        stack: error.stack,
        invoiceId: req.params.invoiceId,
        userId: req.userId
      });
      return res.serverError('Error descargando la factura');
    }
  }
);

// ============================================================================
// WEBHOOKS
// ============================================================================

/**
 * @route   POST /api/payments/webhook/payment-status
 * @desc    Webhook para notificaciones de estado de pago
 * @access  Public (con validación de webhook)
 * @body    Datos del proveedor de pagos
 */
router.post(
  '/webhook/payment-status',
  PaymentController.paymentWebhook
);

// ============================================================================
// RUTAS PARA ADMINISTRADORES
// ============================================================================

/**
 * @route   GET /api/payments/admin/stats
 * @desc    Obtener estadísticas generales de pagos (Admin)
 * @access  Private (Admin)
 * @query   {
 *            startDate: Date,
 *            endDate: Date,
 *            groupBy: String // 'day', 'week', 'month'
 *          }
 */
router.get(
  '/admin/stats',
  authenticate,
  authorize(['admin']),
  async (req, res, next) => {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;
      
      let matchQuery = {};
      if (startDate || endDate) {
        matchQuery.createdAt = {};
        if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
        if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
      }

      const Payment = require('../models/Payment');
      
      // Estadísticas generales
      const generalStats = await Payment.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalPayments: { $sum: 1 },
            completedPayments: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            totalRevenue: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] }
            },
            totalPlatformFees: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$platformFee', 0] }
            },
            totalRefunds: {
              $sum: { $cond: [{ $eq: ['$refundStatus', 'completed'] }, '$refundAmount', 0] }
            },
            avgPaymentAmount: { $avg: '$totalAmount' }
          }
        }
      ]);

      // Estadísticas por período
      let groupByFormat;
      switch (groupBy) {
        case 'week':
          groupByFormat = { $week: '$createdAt' };
          break;
        case 'month':
          groupByFormat = { $month: '$createdAt' };
          break;
        default:
          groupByFormat = { $dayOfYear: '$createdAt' };
      }

      const periodStats = await Payment.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: groupByFormat,
            date: { $first: '$createdAt' },
            payments: { $sum: 1 },
            revenue: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] }
            },
            platformFees: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$platformFee', 0] }
            }
          }
        },
        { $sort: { '_id': 1 } }
      ]);

      const result = {
        general: generalStats[0] || {
          totalPayments: 0,
          completedPayments: 0,
          totalRevenue: 0,
          totalPlatformFees: 0,
          totalRefunds: 0,
          avgPaymentAmount: 0
        },
        byPeriod: periodStats
      };

      return res.success(result, 'Estadísticas de pagos obtenidas exitosamente');

    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error obteniendo estadísticas de pagos (admin):', {
        error: error.message,
        stack: error.stack
      });
      return res.serverError('Error obteniendo las estadísticas');
    }
  }
);

module.exports = router;