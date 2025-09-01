/**
 * Controlador para gestión de solicitudes de servicios
 * Maneja la creación, búsqueda, matching y gestión de servicios
 */

const ServiceRequest = require('../models/ServiceRequest');
const Professional = require('../models/Professional');
const User = require('../models/User');
const { GeolocationUtils } = require('../utils/geolocation');
const { NotificationService } = require('../utils/notifications');
const logger = require('../utils/logger');
const { validateServiceRequest, validateQuote } = require('../utils/validation');

class ServiceController {
  /**
   * Crear una nueva solicitud de servicio
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async createServiceRequest(req, res) {
    try {
      const userId = req.userId;
      const serviceData = req.body;

      // Validar datos de entrada
      const validation = validateServiceRequest(serviceData);
      if (!validation.isValid) {
        return res.validationError(validation.errors);
      }

      // Verificar que el usuario sea un cliente
      if (req.userRole !== 'client') {
        return res.forbidden('Solo los clientes pueden crear solicitudes de servicio');
      }

      // Geocodificar la dirección si se proporciona
      let coordinates = null;
      if (serviceData.address) {
        try {
          const geocodeResult = await GeolocationUtils.geocodeAddress(serviceData.address);
          if (geocodeResult.success) {
            coordinates = {
              type: 'Point',
              coordinates: [geocodeResult.data.lng, geocodeResult.data.lat]
            };
          }
        } catch (geocodeError) {
          logger.warn('Error geocodificando dirección:', {
            address: serviceData.address,
            error: geocodeError.message
          });
        }
      }

      // Crear la solicitud de servicio
      const serviceRequest = new ServiceRequest({
        client: userId,
        category: serviceData.category,
        subcategory: serviceData.subcategory,
        title: serviceData.title,
        description: serviceData.description,
        address: serviceData.address,
        location: coordinates,
        urgency: serviceData.urgency || 'medium',
        budget: serviceData.budget,
        preferredDate: serviceData.preferredDate,
        preferredTime: serviceData.preferredTime,
        requirements: serviceData.requirements || [],
        images: serviceData.images || [],
        isEmergency: serviceData.isEmergency || false
      });

      await serviceRequest.save();

      // Buscar profesionales cercanos y compatibles
      const matchingProfessionals = await ServiceController.findMatchingProfessionals(
        serviceRequest,
        coordinates
      );

      // Enviar notificaciones a profesionales compatibles
      if (matchingProfessionals.length > 0) {
        await ServiceController.notifyMatchingProfessionals(
          serviceRequest,
          matchingProfessionals
        );
      }

      // Poblar datos para la respuesta
      await serviceRequest.populate([
        { path: 'client', select: 'firstName lastName email phone' }
      ]);

      logger.info('Solicitud de servicio creada:', {
        serviceRequestId: serviceRequest._id,
        clientId: userId,
        category: serviceData.category,
        matchingProfessionals: matchingProfessionals.length
      });

      return res.success({
        serviceRequest,
        matchingProfessionals: matchingProfessionals.length,
        message: `Se encontraron ${matchingProfessionals.length} profesionales compatibles`
      }, 'Solicitud de servicio creada exitosamente', 201);

    } catch (error) {
      logger.error('Error creando solicitud de servicio:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId
      });
      return res.serverError('Error creando la solicitud de servicio');
    }
  }

  /**
   * Buscar profesionales compatibles con una solicitud de servicio
   * @param {Object} serviceRequest - Solicitud de servicio
   * @param {Object} coordinates - Coordenadas de ubicación
   * @returns {Array} Lista de profesionales compatibles
   */
  static async findMatchingProfessionals(serviceRequest, coordinates) {
    try {
      const searchRadius = 50000; // 50km en metros
      const matchQuery = {
        isVerified: true,
        isActive: true,
        'services.category': serviceRequest.category
      };

      // Agregar filtro de subcategoría si está especificada
      if (serviceRequest.subcategory) {
        matchQuery['services.subcategory'] = serviceRequest.subcategory;
      }

      // Agregar filtro de ubicación si hay coordenadas
      if (coordinates) {
        matchQuery.location = {
          $near: {
            $geometry: coordinates,
            $maxDistance: searchRadius
          }
        };
      }

      const professionals = await Professional.find(matchQuery)
        .populate('user', 'firstName lastName email phone isActive')
        .select('businessName services rating reviewCount location availability user')
        .limit(20);

      // Filtrar por disponibilidad si se especifica fecha preferida
      let availableProfessionals = professionals;
      if (serviceRequest.preferredDate) {
        availableProfessionals = professionals.filter(prof => {
          return ServiceController.isProfessionalAvailable(
            prof,
            serviceRequest.preferredDate,
            serviceRequest.preferredTime
          );
        });
      }

      // Calcular distancia y ordenar por relevancia
      if (coordinates) {
        for (const prof of availableProfessionals) {
          if (prof.location && prof.location.coordinates) {
            const distance = GeolocationUtils.calculateDistance(
              coordinates.coordinates[1], // lat
              coordinates.coordinates[0], // lng
              prof.location.coordinates[1],
              prof.location.coordinates[0]
            );
            prof.distance = distance;
          }
        }

        // Ordenar por distancia y rating
        availableProfessionals.sort((a, b) => {
          const scoreA = (a.rating || 0) * 0.7 + (1 / (a.distance || 1)) * 0.3;
          const scoreB = (b.rating || 0) * 0.7 + (1 / (b.distance || 1)) * 0.3;
          return scoreB - scoreA;
        });
      } else {
        // Ordenar solo por rating si no hay ubicación
        availableProfessionals.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      }

      return availableProfessionals;

    } catch (error) {
      logger.error('Error buscando profesionales compatibles:', {
        error: error.message,
        serviceRequestId: serviceRequest._id
      });
      return [];
    }
  }

  /**
   * Verificar si un profesional está disponible en una fecha/hora específica
   * @param {Object} professional - Profesional
   * @param {Date} date - Fecha preferida
   * @param {String} time - Hora preferida
   * @returns {Boolean} True si está disponible
   */
  static isProfessionalAvailable(professional, date, time) {
    if (!professional.availability || !date) return true;

    const dayOfWeek = new Date(date).getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];

    const dayAvailability = professional.availability[dayName];
    if (!dayAvailability || !dayAvailability.isAvailable) {
      return false;
    }

    // Si no se especifica hora, considerar disponible
    if (!time || !dayAvailability.hours) return true;

    // Verificar si la hora está dentro del rango disponible
    const requestTime = time.replace(':', '');
    const startTime = dayAvailability.hours.start.replace(':', '');
    const endTime = dayAvailability.hours.end.replace(':', '');

    return requestTime >= startTime && requestTime <= endTime;
  }

  /**
   * Enviar notificaciones a profesionales compatibles
   * @param {Object} serviceRequest - Solicitud de servicio
   * @param {Array} professionals - Lista de profesionales
   */
  static async notifyMatchingProfessionals(serviceRequest, professionals) {
    try {
      const notificationPromises = professionals.map(async (professional) => {
        if (professional.user && professional.user.isActive) {
          try {
            await NotificationService.sendNewServiceRequestNotification(
              professional.user._id,
              serviceRequest
            );
          } catch (notifError) {
            logger.warn('Error enviando notificación a profesional:', {
              professionalId: professional._id,
              error: notifError.message
            });
          }
        }
      });

      await Promise.allSettled(notificationPromises);

      logger.info('Notificaciones enviadas a profesionales:', {
        serviceRequestId: serviceRequest._id,
        professionalsNotified: professionals.length
      });

    } catch (error) {
      logger.error('Error enviando notificaciones:', {
        error: error.message,
        serviceRequestId: serviceRequest._id
      });
    }
  }

  /**
   * Obtener solicitudes de servicio con filtros
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async getServiceRequests(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        category,
        subcategory,
        urgency,
        location,
        radius = 50,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const query = {};

      // Filtros básicos
      if (status) query.status = status;
      if (category) query.category = category;
      if (subcategory) query.subcategory = subcategory;
      if (urgency) query.urgency = urgency;

      // Filtro de ubicación
      if (location) {
        try {
          const [lat, lng] = location.split(',').map(coord => parseFloat(coord.trim()));
          if (!isNaN(lat) && !isNaN(lng)) {
            query.location = {
              $near: {
                $geometry: {
                  type: 'Point',
                  coordinates: [lng, lat]
                },
                $maxDistance: parseInt(radius) * 1000 // convertir km a metros
              }
            };
          }
        } catch (locationError) {
          logger.warn('Error procesando filtro de ubicación:', {
            location,
            error: locationError.message
          });
        }
      }

      // Filtro por rol del usuario
      if (req.userRole === 'client') {
        query.client = req.userId;
      } else if (req.userRole === 'professional') {
        // Los profesionales solo ven solicitudes abiertas o donde han enviado cotizaciones
        query.$or = [
          { status: 'open' },
          { 'quotes.professional': req.user.professional }
        ];
      }

      // Configurar ordenamiento
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Ejecutar consulta
      const [serviceRequests, total] = await Promise.all([
        ServiceRequest.find(query)
          .populate('client', 'firstName lastName email phone')
          .populate('quotes.professional', 'businessName rating')
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        ServiceRequest.countDocuments(query)
      ]);

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasNext: skip + parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      };

      return res.paginated(serviceRequests, pagination);

    } catch (error) {
      logger.error('Error obteniendo solicitudes de servicio:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId
      });
      return res.serverError('Error obteniendo las solicitudes de servicio');
    }
  }

  /**
   * Obtener una solicitud de servicio específica
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async getServiceRequestById(req, res) {
    try {
      const { id } = req.params;

      const serviceRequest = await ServiceRequest.findById(id)
        .populate('client', 'firstName lastName email phone')
        .populate({
          path: 'quotes.professional',
          select: 'businessName rating reviewCount location services',
          populate: {
            path: 'user',
            select: 'firstName lastName'
          }
        })
        .populate('assignedProfessional', 'businessName rating');

      if (!serviceRequest) {
        return res.notFound('Solicitud de servicio no encontrada');
      }

      // Verificar permisos de acceso
      const canAccess = 
        req.userRole === 'admin' ||
        serviceRequest.client._id.toString() === req.userId ||
        (req.userRole === 'professional' && (
          serviceRequest.quotes.some(quote => 
            quote.professional._id.toString() === req.user.professional.toString()
          ) ||
          serviceRequest.assignedProfessional?._id.toString() === req.user.professional.toString()
        ));

      if (!canAccess) {
        return res.forbidden('No tienes permisos para ver esta solicitud');
      }

      return res.success(serviceRequest, 'Solicitud de servicio obtenida exitosamente');

    } catch (error) {
      logger.error('Error obteniendo solicitud de servicio:', {
        error: error.message,
        serviceRequestId: req.params.id,
        userId: req.userId
      });
      return res.serverError('Error obteniendo la solicitud de servicio');
    }
  }

  /**
   * Actualizar una solicitud de servicio
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async updateServiceRequest(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const serviceRequest = await ServiceRequest.findById(id);
      if (!serviceRequest) {
        return res.notFound('Solicitud de servicio no encontrada');
      }

      // Verificar permisos (solo el cliente propietario puede actualizar)
      if (serviceRequest.client.toString() !== req.userId) {
        return res.forbidden('Solo puedes actualizar tus propias solicitudes');
      }

      // No permitir actualización si ya está asignada o completada
      if (['assigned', 'in_progress', 'completed', 'cancelled'].includes(serviceRequest.status)) {
        return res.error('No se puede actualizar una solicitud en este estado', 400);
      }

      // Campos permitidos para actualización
      const allowedUpdates = [
        'title', 'description', 'urgency', 'budget', 
        'preferredDate', 'preferredTime', 'requirements'
      ];
      
      const updateData = {};
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          updateData[field] = updates[field];
        }
      });

      // Actualizar timestamp de modificación
      updateData.updatedAt = new Date();

      const updatedServiceRequest = await ServiceRequest.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).populate('client', 'firstName lastName email phone');

      logger.info('Solicitud de servicio actualizada:', {
        serviceRequestId: id,
        clientId: req.userId,
        updates: Object.keys(updateData)
      });

      return res.success(updatedServiceRequest, 'Solicitud actualizada exitosamente');

    } catch (error) {
      logger.error('Error actualizando solicitud de servicio:', {
        error: error.message,
        serviceRequestId: req.params.id,
        userId: req.userId
      });
      return res.serverError('Error actualizando la solicitud de servicio');
    }
  }

  /**
   * Cancelar una solicitud de servicio
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async cancelServiceRequest(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const serviceRequest = await ServiceRequest.findById(id);
      if (!serviceRequest) {
        return res.notFound('Solicitud de servicio no encontrada');
      }

      // Verificar permisos
      if (serviceRequest.client.toString() !== req.userId) {
        return res.forbidden('Solo puedes cancelar tus propias solicitudes');
      }

      // Verificar que se pueda cancelar
      if (['completed', 'cancelled'].includes(serviceRequest.status)) {
        return res.error('No se puede cancelar una solicitud en este estado', 400);
      }

      // Actualizar estado
      serviceRequest.status = 'cancelled';
      serviceRequest.cancellationReason = reason;
      serviceRequest.cancelledAt = new Date();
      await serviceRequest.save();

      // Notificar al profesional asignado si existe
      if (serviceRequest.assignedProfessional) {
        try {
          const professional = await Professional.findById(serviceRequest.assignedProfessional)
            .populate('user');
          
          if (professional && professional.user) {
            await NotificationService.sendServiceCancellationNotification(
              professional.user._id,
              serviceRequest
            );
          }
        } catch (notifError) {
          logger.warn('Error enviando notificación de cancelación:', {
            error: notifError.message,
            serviceRequestId: id
          });
        }
      }

      logger.info('Solicitud de servicio cancelada:', {
        serviceRequestId: id,
        clientId: req.userId,
        reason
      });

      return res.success(serviceRequest, 'Solicitud cancelada exitosamente');

    } catch (error) {
      logger.error('Error cancelando solicitud de servicio:', {
        error: error.message,
        serviceRequestId: req.params.id,
        userId: req.userId
      });
      return res.serverError('Error cancelando la solicitud de servicio');
    }
  }

  /**
   * Buscar profesionales disponibles para un servicio específico
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async searchProfessionals(req, res) {
    try {
      const {
        category,
        subcategory,
        location,
        radius = 50,
        minRating = 0,
        maxPrice,
        availability,
        page = 1,
        limit = 10,
        sortBy = 'rating',
        sortOrder = 'desc'
      } = req.query;

      if (!category) {
        return res.error('Categoría de servicio requerida', 400);
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const query = {
        isVerified: true,
        isActive: true,
        'services.category': category
      };

      // Filtros adicionales
      if (subcategory) {
        query['services.subcategory'] = subcategory;
      }

      if (minRating > 0) {
        query.rating = { $gte: parseFloat(minRating) };
      }

      if (maxPrice) {
        query['services.price'] = { $lte: parseFloat(maxPrice) };
      }

      // Filtro de ubicación
      if (location) {
        try {
          const [lat, lng] = location.split(',').map(coord => parseFloat(coord.trim()));
          if (!isNaN(lat) && !isNaN(lng)) {
            query.location = {
              $near: {
                $geometry: {
                  type: 'Point',
                  coordinates: [lng, lat]
                },
                $maxDistance: parseInt(radius) * 1000
              }
            };
          }
        } catch (locationError) {
          return res.error('Formato de ubicación inválido. Use: lat,lng', 400);
        }
      }

      // Configurar ordenamiento
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Ejecutar búsqueda
      const [professionals, total] = await Promise.all([
        Professional.find(query)
          .populate('user', 'firstName lastName')
          .select('businessName services rating reviewCount location availability')
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        Professional.countDocuments(query)
      ]);

      // Calcular distancia si hay ubicación
      if (location) {
        const [lat, lng] = location.split(',').map(coord => parseFloat(coord.trim()));
        professionals.forEach(prof => {
          if (prof.location && prof.location.coordinates) {
            prof.distance = GeolocationUtils.calculateDistance(
              lat, lng,
              prof.location.coordinates[1],
              prof.location.coordinates[0]
            );
          }
        });
      }

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasNext: skip + parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      };

      return res.paginated(professionals, pagination, 'Profesionales encontrados exitosamente');

    } catch (error) {
      logger.error('Error buscando profesionales:', {
        error: error.message,
        stack: error.stack,
        query: req.query
      });
      return res.serverError('Error buscando profesionales');
    }
  }
}

module.exports = ServiceController;