/**
 * Rutas para gestión de cotizaciones
 * Maneja endpoints para envío, aceptación y gestión de cotizaciones
 */

const express = require('express');
const QuoteController = require('../controllers/quoteController');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authenticate');
const responseMiddleware = require('../middleware/responseMiddleware');
const { createUserRateLimit } = require('../middleware/rateLimitByUser');

const router = express.Router();

// Aplicar middleware de respuesta a todas las rutas
router.use(responseMiddleware);

// Rate limiting específico para cotizaciones
const quoteRateLimit = createUserRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // máximo 20 cotizaciones por ventana
  message: 'Demasiadas cotizaciones enviadas. Intenta de nuevo en 15 minutos.',
  keyGenerator: (req) => {
    return req.user ? `quote_${req.user.id}` : `quote_ip_${req.ip}`;
  }
});

const quoteUpdateRateLimit = createUserRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // máximo 10 actualizaciones por ventana
  message: 'Demasiadas actualizaciones de cotizaciones. Intenta de nuevo en 5 minutos.',
  keyGenerator: (req) => {
    return req.user ? `quote_update_${req.user.id}` : `quote_update_ip_${req.ip}`;
  }
});

// ============================================================================
// RUTAS PARA PROFESIONALES
// ============================================================================

/**
 * @route   POST /api/quotes/service-requests/:serviceRequestId
 * @desc    Enviar una cotización para una solicitud de servicio
 * @access  Private (Profesionales)
 * @params  serviceRequestId - ID de la solicitud de servicio
 * @body    {
 *            price: Number (required),
 *            description: String (required),
 *            estimatedDuration: String,
 *            availableDate: Date,
 *            availableTime: String,
 *            materials: [{ name: String, cost: Number, quantity: Number }],
 *            warranty: String,
 *            terms: String,
 *            validUntil: Date
 *          }
 */
router.post(
  '/service-requests/:serviceRequestId',
  authenticate,
  authorize(['professional']),
  quoteRateLimit,
  QuoteController.sendQuote
);

/**
 * @route   GET /api/quotes/my-quotes
 * @desc    Obtener todas las cotizaciones enviadas por el profesional
 * @access  Private (Profesionales)
 * @query   {
 *            page: Number,
 *            limit: Number,
 *            status: String,
 *            sortBy: String,
 *            sortOrder: String
 *          }
 */
router.get(
  '/my-quotes',
  authenticate,
  authorize(['professional']),
  QuoteController.getProfessionalQuotes
);

/**
 * @route   PUT /api/quotes/service-requests/:serviceRequestId/quotes/:quoteId
 * @desc    Actualizar una cotización existente
 * @access  Private (Profesionales - solo propias cotizaciones)
 * @params  serviceRequestId - ID de la solicitud de servicio
 * @params  quoteId - ID de la cotización
 * @body    {
 *            price: Number,
 *            description: String,
 *            estimatedDuration: String,
 *            availableDate: Date,
 *            availableTime: String,
 *            materials: [{ name: String, cost: Number, quantity: Number }],
 *            warranty: String,
 *            terms: String,
 *            validUntil: Date
 *          }
 */
router.put(
  '/service-requests/:serviceRequestId/quotes/:quoteId',
  authenticate,
  authorize(['professional']),
  quoteUpdateRateLimit,
  QuoteController.updateQuote
);

/**
 * @route   DELETE /api/quotes/service-requests/:serviceRequestId/quotes/:quoteId
 * @desc    Retirar una cotización
 * @access  Private (Profesionales - solo propias cotizaciones)
 * @params  serviceRequestId - ID de la solicitud de servicio
 * @params  quoteId - ID de la cotización
 * @body    { reason: String }
 */
router.delete(
  '/service-requests/:serviceRequestId/quotes/:quoteId',
  authenticate,
  authorize(['professional']),
  QuoteController.withdrawQuote
);

/**
 * @route   GET /api/quotes/stats
 * @desc    Obtener estadísticas de cotizaciones del profesional
 * @access  Private (Profesionales)
 */
router.get(
  '/stats',
  authenticate,
  authorize(['professional']),
  QuoteController.getQuoteStats
);

// ============================================================================
// RUTAS PARA CLIENTES
// ============================================================================

/**
 * @route   POST /api/quotes/service-requests/:serviceRequestId/quotes/:quoteId/accept
 * @desc    Aceptar una cotización
 * @access  Private (Clientes - solo propias solicitudes)
 * @params  serviceRequestId - ID de la solicitud de servicio
 * @params  quoteId - ID de la cotización
 * @body    { message: String }
 */
router.post(
  '/service-requests/:serviceRequestId/quotes/:quoteId/accept',
  authenticate,
  authorize(['client']),
  QuoteController.acceptQuote
);

// ============================================================================
// RUTAS MIXTAS (CLIENTES Y PROFESIONALES)
// ============================================================================

/**
 * @route   GET /api/quotes/service-requests/:serviceRequestId/quotes
 * @desc    Obtener todas las cotizaciones de una solicitud de servicio
 * @access  Private (Cliente propietario o Profesionales que han cotizado)
 * @params  serviceRequestId - ID de la solicitud de servicio
 * @query   {
 *            sortBy: String,
 *            sortOrder: String
 *          }
 */
router.get(
  '/service-requests/:serviceRequestId/quotes',
  authenticate,
  async (req, res, next) => {
    try {
      const { serviceRequestId } = req.params;
      const { sortBy = 'sentAt', sortOrder = 'desc' } = req.query;
      
      const ServiceRequest = require('../models/ServiceRequest');
      
      // Buscar la solicitud de servicio
      const serviceRequest = await ServiceRequest.findById(serviceRequestId)
        .populate({
          path: 'quotes.professional',
          select: 'businessName rating reviewCount location',
          populate: {
            path: 'user',
            select: 'firstName lastName profileImage'
          }
        })
        .populate('client', 'firstName lastName');

      if (!serviceRequest) {
        return res.notFound('Solicitud de servicio no encontrada');
      }

      // Verificar permisos de acceso
      const isClient = req.userRole === 'client' && serviceRequest.client._id.toString() === req.userId;
      const isProfessionalWithQuote = req.userRole === 'professional' && 
        serviceRequest.quotes.some(quote => 
          quote.professional._id.toString() === req.user.professional.toString()
        );
      const isAdmin = req.userRole === 'admin';

      if (!isClient && !isProfessionalWithQuote && !isAdmin) {
        return res.forbidden('No tienes permisos para ver estas cotizaciones');
      }

      // Ordenar cotizaciones
      let quotes = [...serviceRequest.quotes];
      quotes.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        
        if (sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });

      // Si es un profesional, solo mostrar su propia cotización y las aceptadas
      if (req.userRole === 'professional' && !isAdmin) {
        quotes = quotes.filter(quote => 
          quote.professional._id.toString() === req.user.professional.toString() ||
          serviceRequest.acceptedQuote?.toString() === quote._id.toString()
        );
      }

      const response = {
        serviceRequest: {
          _id: serviceRequest._id,
          title: serviceRequest.title,
          status: serviceRequest.status,
          quotesCount: serviceRequest.quotesCount,
          acceptedQuote: serviceRequest.acceptedQuote,
          assignedProfessional: serviceRequest.assignedProfessional
        },
        quotes,
        permissions: {
          canAcceptQuotes: isClient && serviceRequest.status === 'open',
          canSendQuote: req.userRole === 'professional' && serviceRequest.status === 'open' &&
            !serviceRequest.quotes.some(q => q.professional._id.toString() === req.user.professional.toString())
        }
      };

      return res.success(response, 'Cotizaciones obtenidas exitosamente');

    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error obteniendo cotizaciones:', {
        error: error.message,
        stack: error.stack,
        serviceRequestId: req.params.serviceRequestId,
        userId: req.userId
      });
      return res.serverError('Error obteniendo las cotizaciones');
    }
  }
);

/**
 * @route   GET /api/quotes/service-requests/:serviceRequestId/quotes/:quoteId
 * @desc    Obtener una cotización específica
 * @access  Private (Cliente propietario, Profesional autor, o Admin)
 * @params  serviceRequestId - ID de la solicitud de servicio
 * @params  quoteId - ID de la cotización
 */
router.get(
  '/service-requests/:serviceRequestId/quotes/:quoteId',
  authenticate,
  async (req, res, next) => {
    try {
      const { serviceRequestId, quoteId } = req.params;
      
      const ServiceRequest = require('../models/ServiceRequest');
      
      // Buscar la solicitud de servicio
      const serviceRequest = await ServiceRequest.findById(serviceRequestId)
        .populate({
          path: 'quotes.professional',
          select: 'businessName rating reviewCount location services',
          populate: {
            path: 'user',
            select: 'firstName lastName profileImage email phone'
          }
        })
        .populate('client', 'firstName lastName email phone');

      if (!serviceRequest) {
        return res.notFound('Solicitud de servicio no encontrada');
      }

      // Buscar la cotización específica
      const quote = serviceRequest.quotes.id(quoteId);
      if (!quote) {
        return res.notFound('Cotización no encontrada');
      }

      // Verificar permisos de acceso
      const isClient = req.userRole === 'client' && serviceRequest.client._id.toString() === req.userId;
      const isProfessionalAuthor = req.userRole === 'professional' && 
        quote.professional._id.toString() === req.user.professional.toString();
      const isAdmin = req.userRole === 'admin';

      if (!isClient && !isProfessionalAuthor && !isAdmin) {
        return res.forbidden('No tienes permisos para ver esta cotización');
      }

      const response = {
        serviceRequest: {
          _id: serviceRequest._id,
          title: serviceRequest.title,
          description: serviceRequest.description,
          status: serviceRequest.status,
          client: isClient || isAdmin ? serviceRequest.client : {
            firstName: serviceRequest.client.firstName,
            lastName: serviceRequest.client.lastName
          }
        },
        quote,
        isAccepted: serviceRequest.acceptedQuote?.toString() === quoteId,
        isAssigned: serviceRequest.assignedProfessional?.toString() === quote.professional._id.toString()
      };

      return res.success(response, 'Cotización obtenida exitosamente');

    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Error obteniendo cotización específica:', {
        error: error.message,
        stack: error.stack,
        serviceRequestId: req.params.serviceRequestId,
        quoteId: req.params.quoteId,
        userId: req.userId
      });
      return res.serverError('Error obteniendo la cotización');
    }
  }
);

module.exports = router;