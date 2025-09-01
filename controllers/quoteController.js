/**
 * Controlador para gestión de cotizaciones
 * Maneja el envío, aceptación y gestión de cotizaciones entre profesionales y clientes
 */

const ServiceRequest = require('../models/ServiceRequest');
const Professional = require('../models/Professional');
const User = require('../models/User');
const { NotificationService } = require('../utils/notifications');
const logger = require('../utils/logger');
const { validateQuote } = require('../utils/validation');

class QuoteController {
  /**
   * Enviar una cotización para una solicitud de servicio
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async sendQuote(req, res) {
    try {
      const { serviceRequestId } = req.params;
      const quoteData = req.body;
      const professionalId = req.user.professional;

      // Validar datos de entrada
      const validation = validateQuote(quoteData);
      if (!validation.isValid) {
        return res.validationError(validation.errors);
      }

      // Verificar que el usuario sea un profesional
      if (req.userRole !== 'professional') {
        return res.forbidden('Solo los profesionales pueden enviar cotizaciones');
      }

      // Buscar la solicitud de servicio
      const serviceRequest = await ServiceRequest.findById(serviceRequestId)
        .populate('client', 'firstName lastName email');

      if (!serviceRequest) {
        return res.notFound('Solicitud de servicio no encontrada');
      }

      // Verificar que la solicitud esté abierta
      if (serviceRequest.status !== 'open') {
        return res.error('Esta solicitud ya no está disponible para cotizaciones', 400);
      }

      // Verificar que el profesional no haya enviado ya una cotización
      const existingQuote = serviceRequest.quotes.find(
        quote => quote.professional.toString() === professionalId.toString()
      );

      if (existingQuote) {
        return res.conflict('Ya has enviado una cotización para esta solicitud');
      }

      // Obtener información del profesional
      const professional = await Professional.findById(professionalId)
        .populate('user', 'firstName lastName');

      if (!professional) {
        return res.notFound('Perfil profesional no encontrado');
      }

      // Verificar que el profesional esté verificado
      if (!professional.isVerified) {
        return res.forbidden('Debes tener un perfil verificado para enviar cotizaciones');
      }

      // Verificar que el profesional ofrezca el servicio solicitado
      const offersService = professional.services.some(
        service => service.category === serviceRequest.category &&
                  (!serviceRequest.subcategory || service.subcategory === serviceRequest.subcategory)
      );

      if (!offersService) {
        return res.forbidden('No ofreces este tipo de servicio');
      }

      // Crear la cotización
      const quote = {
        professional: professionalId,
        price: quoteData.price,
        description: quoteData.description,
        estimatedDuration: quoteData.estimatedDuration,
        availableDate: quoteData.availableDate,
        availableTime: quoteData.availableTime,
        materials: quoteData.materials || [],
        warranty: quoteData.warranty,
        terms: quoteData.terms,
        validUntil: quoteData.validUntil || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días por defecto
        sentAt: new Date()
      };

      // Agregar la cotización a la solicitud
      serviceRequest.quotes.push(quote);
      serviceRequest.quotesCount = serviceRequest.quotes.length;
      await serviceRequest.save();

      // Enviar notificación al cliente
      try {
        await NotificationService.sendQuoteReceivedNotification(
          serviceRequest.client._id,
          serviceRequest,
          professional
        );
      } catch (notifError) {
        logger.warn('Error enviando notificación de cotización:', {
          error: notifError.message,
          serviceRequestId,
          professionalId
        });
      }

      // Poblar datos para la respuesta
      await serviceRequest.populate({
        path: 'quotes.professional',
        select: 'businessName rating reviewCount',
        populate: {
          path: 'user',
          select: 'firstName lastName'
        }
      });

      const sentQuote = serviceRequest.quotes[serviceRequest.quotes.length - 1];

      logger.info('Cotización enviada:', {
        serviceRequestId,
        professionalId,
        price: quoteData.price,
        clientId: serviceRequest.client._id
      });

      return res.success({
        quote: sentQuote,
        serviceRequest: {
          _id: serviceRequest._id,
          title: serviceRequest.title,
          status: serviceRequest.status,
          quotesCount: serviceRequest.quotesCount
        }
      }, 'Cotización enviada exitosamente', 201);

    } catch (error) {
      logger.error('Error enviando cotización:', {
        error: error.message,
        stack: error.stack,
        serviceRequestId: req.params.serviceRequestId,
        professionalId: req.user?.professional
      });
      return res.serverError('Error enviando la cotización');
    }
  }

  /**
   * Obtener cotizaciones de un profesional
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async getProfessionalQuotes(req, res) {
    try {
      const professionalId = req.user.professional;
      const {
        page = 1,
        limit = 10,
        status,
        sortBy = 'sentAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const matchQuery = {
        'quotes.professional': professionalId
      };

      // Filtro por estado de la solicitud
      if (status) {
        matchQuery.status = status;
      }

      // Configurar ordenamiento
      const sortOptions = {};
      sortOptions[`quotes.${sortBy}`] = sortOrder === 'desc' ? -1 : 1;

      // Buscar solicitudes con cotizaciones del profesional
      const serviceRequests = await ServiceRequest.find(matchQuery)
        .populate('client', 'firstName lastName email phone')
        .populate({
          path: 'quotes.professional',
          select: 'businessName rating',
          populate: {
            path: 'user',
            select: 'firstName lastName'
          }
        })
        .sort({ 'quotes.sentAt': sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit));

      // Filtrar solo las cotizaciones del profesional
      const quotesWithRequests = serviceRequests.map(request => {
        const professionalQuote = request.quotes.find(
          quote => quote.professional._id.toString() === professionalId.toString()
        );

        return {
          _id: professionalQuote._id,
          serviceRequest: {
            _id: request._id,
            title: request.title,
            description: request.description,
            category: request.category,
            subcategory: request.subcategory,
            status: request.status,
            budget: request.budget,
            urgency: request.urgency,
            client: request.client,
            createdAt: request.createdAt
          },
          quote: professionalQuote,
          isAccepted: request.acceptedQuote?.toString() === professionalQuote._id.toString(),
          isAssigned: request.assignedProfessional?.toString() === professionalId.toString()
        };
      });

      const total = await ServiceRequest.countDocuments(matchQuery);

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasNext: skip + parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      };

      return res.paginated(quotesWithRequests, pagination, 'Cotizaciones obtenidas exitosamente');

    } catch (error) {
      logger.error('Error obteniendo cotizaciones del profesional:', {
        error: error.message,
        stack: error.stack,
        professionalId: req.user?.professional
      });
      return res.serverError('Error obteniendo las cotizaciones');
    }
  }

  /**
   * Actualizar una cotización existente
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async updateQuote(req, res) {
    try {
      const { serviceRequestId, quoteId } = req.params;
      const updates = req.body;
      const professionalId = req.user.professional;

      // Buscar la solicitud de servicio
      const serviceRequest = await ServiceRequest.findById(serviceRequestId);
      if (!serviceRequest) {
        return res.notFound('Solicitud de servicio no encontrada');
      }

      // Buscar la cotización específica
      const quote = serviceRequest.quotes.id(quoteId);
      if (!quote) {
        return res.notFound('Cotización no encontrada');
      }

      // Verificar que la cotización pertenezca al profesional
      if (quote.professional.toString() !== professionalId.toString()) {
        return res.forbidden('Solo puedes actualizar tus propias cotizaciones');
      }

      // Verificar que la cotización no haya sido aceptada
      if (serviceRequest.acceptedQuote?.toString() === quoteId) {
        return res.error('No se puede actualizar una cotización ya aceptada', 400);
      }

      // Verificar que la solicitud siga abierta
      if (serviceRequest.status !== 'open') {
        return res.error('No se puede actualizar cotizaciones en solicitudes cerradas', 400);
      }

      // Campos permitidos para actualización
      const allowedUpdates = [
        'price', 'description', 'estimatedDuration', 'availableDate', 
        'availableTime', 'materials', 'warranty', 'terms', 'validUntil'
      ];

      // Aplicar actualizaciones
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          quote[field] = updates[field];
        }
      });

      quote.updatedAt = new Date();
      await serviceRequest.save();

      // Enviar notificación al cliente sobre la actualización
      try {
        const professional = await Professional.findById(professionalId)
          .populate('user', 'firstName lastName');
        
        await NotificationService.sendQuoteUpdatedNotification(
          serviceRequest.client,
          serviceRequest,
          professional
        );
      } catch (notifError) {
        logger.warn('Error enviando notificación de actualización:', {
          error: notifError.message,
          serviceRequestId,
          quoteId
        });
      }

      logger.info('Cotización actualizada:', {
        serviceRequestId,
        quoteId,
        professionalId,
        updates: Object.keys(updates)
      });

      return res.success(quote, 'Cotización actualizada exitosamente');

    } catch (error) {
      logger.error('Error actualizando cotización:', {
        error: error.message,
        stack: error.stack,
        serviceRequestId: req.params.serviceRequestId,
        quoteId: req.params.quoteId
      });
      return res.serverError('Error actualizando la cotización');
    }
  }

  /**
   * Retirar una cotización
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async withdrawQuote(req, res) {
    try {
      const { serviceRequestId, quoteId } = req.params;
      const { reason } = req.body;
      const professionalId = req.user.professional;

      // Buscar la solicitud de servicio
      const serviceRequest = await ServiceRequest.findById(serviceRequestId);
      if (!serviceRequest) {
        return res.notFound('Solicitud de servicio no encontrada');
      }

      // Buscar la cotización específica
      const quote = serviceRequest.quotes.id(quoteId);
      if (!quote) {
        return res.notFound('Cotización no encontrada');
      }

      // Verificar que la cotización pertenezca al profesional
      if (quote.professional.toString() !== professionalId.toString()) {
        return res.forbidden('Solo puedes retirar tus propias cotizaciones');
      }

      // Verificar que la cotización no haya sido aceptada
      if (serviceRequest.acceptedQuote?.toString() === quoteId) {
        return res.error('No se puede retirar una cotización ya aceptada', 400);
      }

      // Remover la cotización
      serviceRequest.quotes.pull(quoteId);
      serviceRequest.quotesCount = serviceRequest.quotes.length;
      await serviceRequest.save();

      // Enviar notificación al cliente
      try {
        const professional = await Professional.findById(professionalId)
          .populate('user', 'firstName lastName');
        
        await NotificationService.sendQuoteWithdrawnNotification(
          serviceRequest.client,
          serviceRequest,
          professional,
          reason
        );
      } catch (notifError) {
        logger.warn('Error enviando notificación de retiro:', {
          error: notifError.message,
          serviceRequestId,
          quoteId
        });
      }

      logger.info('Cotización retirada:', {
        serviceRequestId,
        quoteId,
        professionalId,
        reason
      });

      return res.success(null, 'Cotización retirada exitosamente');

    } catch (error) {
      logger.error('Error retirando cotización:', {
        error: error.message,
        stack: error.stack,
        serviceRequestId: req.params.serviceRequestId,
        quoteId: req.params.quoteId
      });
      return res.serverError('Error retirando la cotización');
    }
  }

  /**
   * Aceptar una cotización (solo clientes)
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async acceptQuote(req, res) {
    try {
      const { serviceRequestId, quoteId } = req.params;
      const { message } = req.body;

      // Verificar que el usuario sea un cliente
      if (req.userRole !== 'client') {
        return res.forbidden('Solo los clientes pueden aceptar cotizaciones');
      }

      // Buscar la solicitud de servicio
      const serviceRequest = await ServiceRequest.findById(serviceRequestId)
        .populate('client', 'firstName lastName email');

      if (!serviceRequest) {
        return res.notFound('Solicitud de servicio no encontrada');
      }

      // Verificar que el cliente sea el propietario
      if (serviceRequest.client._id.toString() !== req.userId) {
        return res.forbidden('Solo puedes aceptar cotizaciones de tus propias solicitudes');
      }

      // Verificar que la solicitud esté abierta
      if (serviceRequest.status !== 'open') {
        return res.error('Esta solicitud ya no está disponible', 400);
      }

      // Buscar la cotización específica
      const quote = serviceRequest.quotes.id(quoteId);
      if (!quote) {
        return res.notFound('Cotización no encontrada');
      }

      // Verificar que la cotización siga válida
      if (quote.validUntil && new Date() > quote.validUntil) {
        return res.error('Esta cotización ha expirado', 400);
      }

      // Aceptar la cotización
      serviceRequest.acceptedQuote = quoteId;
      serviceRequest.assignedProfessional = quote.professional;
      serviceRequest.status = 'assigned';
      serviceRequest.assignedAt = new Date();
      serviceRequest.finalPrice = quote.price;
      
      if (message) {
        serviceRequest.clientMessage = message;
      }

      await serviceRequest.save();

      // Obtener información del profesional
      const professional = await Professional.findById(quote.professional)
        .populate('user', 'firstName lastName email');

      // Enviar notificaciones
      try {
        // Notificar al profesional aceptado
        await NotificationService.sendQuoteAcceptedNotification(
          professional.user._id,
          serviceRequest,
          quote
        );

        // Notificar a otros profesionales que su cotización no fue aceptada
        const otherQuotes = serviceRequest.quotes.filter(
          q => q._id.toString() !== quoteId && q.professional.toString() !== quote.professional.toString()
        );

        for (const otherQuote of otherQuotes) {
          try {
            const otherProfessional = await Professional.findById(otherQuote.professional)
              .populate('user');
            
            if (otherProfessional && otherProfessional.user) {
              await NotificationService.sendQuoteRejectedNotification(
                otherProfessional.user._id,
                serviceRequest
              );
            }
          } catch (otherNotifError) {
            logger.warn('Error notificando rechazo a profesional:', {
              error: otherNotifError.message,
              professionalId: otherQuote.professional
            });
          }
        }

      } catch (notifError) {
        logger.warn('Error enviando notificaciones de aceptación:', {
          error: notifError.message,
          serviceRequestId,
          quoteId
        });
      }

      logger.info('Cotización aceptada:', {
        serviceRequestId,
        quoteId,
        clientId: req.userId,
        professionalId: quote.professional,
        price: quote.price
      });

      return res.success({
        serviceRequest,
        acceptedQuote: quote,
        professional: {
          _id: professional._id,
          businessName: professional.businessName,
          rating: professional.rating,
          user: professional.user
        }
      }, 'Cotización aceptada exitosamente');

    } catch (error) {
      logger.error('Error aceptando cotización:', {
        error: error.message,
        stack: error.stack,
        serviceRequestId: req.params.serviceRequestId,
        quoteId: req.params.quoteId
      });
      return res.serverError('Error aceptando la cotización');
    }
  }

  /**
   * Obtener estadísticas de cotizaciones
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async getQuoteStats(req, res) {
    try {
      const professionalId = req.user.professional;

      const stats = await ServiceRequest.aggregate([
        { $unwind: '$quotes' },
        { $match: { 'quotes.professional': professionalId } },
        {
          $group: {
            _id: null,
            totalQuotes: { $sum: 1 },
            acceptedQuotes: {
              $sum: {
                $cond: [
                  { $eq: ['$acceptedQuote', '$quotes._id'] },
                  1,
                  0
                ]
              }
            },
            avgQuotePrice: { $avg: '$quotes.price' },
            totalRevenue: {
              $sum: {
                $cond: [
                  { $eq: ['$acceptedQuote', '$quotes._id'] },
                  '$quotes.price',
                  0
                ]
              }
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalQuotes: 0,
        acceptedQuotes: 0,
        avgQuotePrice: 0,
        totalRevenue: 0
      };

      result.acceptanceRate = result.totalQuotes > 0 
        ? (result.acceptedQuotes / result.totalQuotes * 100).toFixed(2)
        : 0;

      return res.success(result, 'Estadísticas de cotizaciones obtenidas exitosamente');

    } catch (error) {
      logger.error('Error obteniendo estadísticas de cotizaciones:', {
        error: error.message,
        stack: error.stack,
        professionalId: req.user?.professional
      });
      return res.serverError('Error obteniendo las estadísticas');
    }
  }
}

module.exports = QuoteController;