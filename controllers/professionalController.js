const Professional = require('../models/Professional');
const User = require('../models/User');
const ServiceRequest = require('../models/ServiceRequest');
const Review = require('../models/Review');
const { validateData } = require('../utils/validation');
const { professionalProfileSchema, serviceSchema, availabilitySchema, quoteSchema } = require('../utils/validation');
const { storageService } = require('../utils/storage');
const { geolocationUtils } = require('../utils/geolocation');
const { notificationService } = require('../utils/notifications');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * Controlador de profesionales
 */
class ProfessionalController {
  /**
   * Crear o actualizar perfil profesional
   */
  static async updateProfessionalProfile(req, res) {
    try {
      // Validar datos
      const { error, value } = validateData(req.body, professionalProfileSchema);
      if (error) {
        return res.badRequest('Datos del perfil profesional inválidos', { errors: error.details });
      }

      const user = req.user;
      
      if (user.role !== 'professional') {
        return res.forbidden('Solo los profesionales pueden actualizar este perfil');
      }

      // Buscar o crear perfil profesional
      let professional = await Professional.findOne({ userId: user._id });
      
      if (!professional) {
        professional = new Professional({
          userId: user._id,
          ...value
        });
      } else {
        // Actualizar campos
        Object.assign(professional, value);
        professional.updatedAt = new Date();
      }

      await professional.save();

      logger.info('Perfil profesional actualizado', {
        userId: user._id,
        professionalId: professional._id,
        businessName: professional.businessInfo.businessName
      });

      res.success('Perfil profesional actualizado exitosamente', {
        professional: {
          id: professional._id,
          businessInfo: professional.businessInfo,
          services: professional.services,
          availability: professional.availability,
          verification: professional.verification,
          rating: professional.rating,
          completionRate: professional.completionRate
        }
      });

    } catch (error) {
      logger.error('Error actualizando perfil profesional', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Obtener perfil profesional
   */
  static async getProfessionalProfile(req, res) {
    try {
      const { professionalId } = req.params;
      const currentUser = req.user;

      if (!mongoose.Types.ObjectId.isValid(professionalId)) {
        return res.badRequest('ID de profesional inválido');
      }

      const professional = await Professional.findById(professionalId)
        .populate('userId', 'profile email createdAt isActive')
        .populate('services.reviews', 'rating comment client createdAt')
        .lean();

      if (!professional || !professional.userId.isActive) {
        return res.notFound('Profesional no encontrado');
      }

      // Obtener estadísticas adicionales
      const stats = await ServiceRequest.aggregate([
        { $match: { professional: professional._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Obtener reseñas recientes
      const recentReviews = await Review.find({
        reviewee: professional.userId._id,
        isPublic: true,
        moderationStatus: 'approved'
      })
        .populate('reviewer', 'profile.firstName profile.lastName profile.profilePhoto')
        .populate('serviceRequest', 'service.title service.category')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      // Calcular disponibilidad actual
      const isCurrentlyAvailable = professional.isCurrentlyAvailable;

      // Ocultar información sensible si no es el propio profesional
      const isOwnProfile = currentUser && currentUser._id.toString() === professional.userId._id.toString();
      
      const responseData = {
        ...professional,
        isCurrentlyAvailable,
        stats: {
          serviceRequests: stats,
          totalCompleted: stats.find(s => s._id === 'completed')?.count || 0,
          totalInProgress: stats.find(s => s._id === 'in_progress')?.count || 0
        },
        recentReviews
      };

      // Remover información sensible si no es el propio perfil
      if (!isOwnProfile) {
        delete responseData.earnings;
        delete responseData.bankInfo;
        delete responseData.documents;
      }

      res.success('Perfil profesional obtenido exitosamente', {
        professional: responseData
      });

    } catch (error) {
      logger.error('Error obteniendo perfil profesional', {
        error: error.message,
        professionalId: req.params.professionalId
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Agregar servicio
   */
  static async addService(req, res) {
    try {
      // Validar datos
      const { error, value } = validateData(req.body, serviceSchema);
      if (error) {
        return res.badRequest('Datos del servicio inválidos', { errors: error.details });
      }

      const user = req.user;
      const professional = await Professional.findOne({ userId: user._id });

      if (!professional) {
        return res.notFound('Perfil profesional no encontrado');
      }

      // Agregar servicio
      const serviceData = {
        ...value,
        _id: new mongoose.Types.ObjectId(),
        createdAt: new Date()
      };

      professional.services.push(serviceData);
      professional.updatedAt = new Date();
      await professional.save();

      logger.info('Servicio agregado', {
        userId: user._id,
        professionalId: professional._id,
        serviceId: serviceData._id,
        category: serviceData.category
      });

      res.created('Servicio agregado exitosamente', {
        service: serviceData
      });

    } catch (error) {
      logger.error('Error agregando servicio', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Actualizar servicio
   */
  static async updateService(req, res) {
    try {
      const { serviceId } = req.params;
      
      // Validar datos
      const { error, value } = validateData(req.body, serviceSchema);
      if (error) {
        return res.badRequest('Datos del servicio inválidos', { errors: error.details });
      }

      const user = req.user;
      const professional = await Professional.findOne({ userId: user._id });

      if (!professional) {
        return res.notFound('Perfil profesional no encontrado');
      }

      const serviceIndex = professional.services.findIndex(
        service => service._id.toString() === serviceId
      );

      if (serviceIndex === -1) {
        return res.notFound('Servicio no encontrado');
      }

      // Actualizar servicio
      professional.services[serviceIndex] = {
        ...professional.services[serviceIndex].toObject(),
        ...value,
        updatedAt: new Date()
      };
      professional.updatedAt = new Date();
      await professional.save();

      logger.info('Servicio actualizado', {
        userId: user._id,
        professionalId: professional._id,
        serviceId,
        category: value.category
      });

      res.success('Servicio actualizado exitosamente', {
        service: professional.services[serviceIndex]
      });

    } catch (error) {
      logger.error('Error actualizando servicio', {
        error: error.message,
        userId: req.user?._id,
        serviceId: req.params.serviceId
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Eliminar servicio
   */
  static async deleteService(req, res) {
    try {
      const { serviceId } = req.params;
      const user = req.user;
      
      const professional = await Professional.findOne({ userId: user._id });

      if (!professional) {
        return res.notFound('Perfil profesional no encontrado');
      }

      const serviceIndex = professional.services.findIndex(
        service => service._id.toString() === serviceId
      );

      if (serviceIndex === -1) {
        return res.notFound('Servicio no encontrado');
      }

      // Verificar si hay solicitudes activas para este servicio
      const activeRequests = await ServiceRequest.countDocuments({
        professional: professional._id,
        'service.category': professional.services[serviceIndex].category,
        status: { $in: ['pending', 'accepted', 'in_progress'] }
      });

      if (activeRequests > 0) {
        return res.badRequest('No se puede eliminar el servicio porque tiene solicitudes activas');
      }

      // Eliminar servicio
      professional.services.splice(serviceIndex, 1);
      professional.updatedAt = new Date();
      await professional.save();

      logger.info('Servicio eliminado', {
        userId: user._id,
        professionalId: professional._id,
        serviceId
      });

      res.success('Servicio eliminado exitosamente');

    } catch (error) {
      logger.error('Error eliminando servicio', {
        error: error.message,
        userId: req.user?._id,
        serviceId: req.params.serviceId
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Actualizar disponibilidad
   */
  static async updateAvailability(req, res) {
    try {
      // Validar datos
      const { error, value } = validateData(req.body, availabilitySchema);
      if (error) {
        return res.badRequest('Datos de disponibilidad inválidos', { errors: error.details });
      }

      const user = req.user;
      const professional = await Professional.findOne({ userId: user._id });

      if (!professional) {
        return res.notFound('Perfil profesional no encontrado');
      }

      // Actualizar disponibilidad
      professional.availability = { ...professional.availability, ...value };
      professional.updatedAt = new Date();
      await professional.save();

      logger.info('Disponibilidad actualizada', {
        userId: user._id,
        professionalId: professional._id
      });

      res.success('Disponibilidad actualizada exitosamente', {
        availability: professional.availability
      });

    } catch (error) {
      logger.error('Error actualizando disponibilidad', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Buscar profesionales
   */
  static async searchProfessionals(req, res) {
    try {
      const {
        category,
        subcategory,
        location,
        radius = 10,
        minRating = 0,
        maxPrice,
        availability,
        verified,
        page = 1,
        limit = 10,
        sortBy = 'rating'
      } = req.query;

      // Construir filtros
      const matchStage = {
        'userId.isActive': true
      };

      if (category) {
        matchStage['services.category'] = category;
      }

      if (subcategory) {
        matchStage['services.subcategory'] = subcategory;
      }

      if (minRating > 0) {
        matchStage['rating.average'] = { $gte: parseFloat(minRating) };
      }

      if (maxPrice) {
        matchStage['services.pricing.basePrice'] = { $lte: parseFloat(maxPrice) };
      }

      if (verified === 'true') {
        matchStage['verification.isVerified'] = true;
      }

      if (availability === 'true') {
        matchStage['availability.isCurrentlyAvailable'] = true;
      }

      // Pipeline de agregación
      const pipeline = [
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userId'
          }
        },
        { $unwind: '$userId' },
        { $match: matchStage }
      ];

      // Filtro por ubicación
      if (location) {
        const [lat, lng] = location.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          pipeline.push({
            $geoNear: {
              near: {
                type: 'Point',
                coordinates: [lng, lat]
              },
              distanceField: 'distance',
              maxDistance: radius * 1000, // convertir km a metros
              spherical: true
            }
          });
        }
      }

      // Ordenamiento
      const sortStage = {};
      switch (sortBy) {
        case 'rating':
          sortStage['rating.average'] = -1;
          break;
        case 'price':
          sortStage['services.pricing.basePrice'] = 1;
          break;
        case 'distance':
          if (location) {
            sortStage.distance = 1;
          } else {
            sortStage['rating.average'] = -1;
          }
          break;
        case 'reviews':
          sortStage['rating.count'] = -1;
          break;
        default:
          sortStage['rating.average'] = -1;
      }

      pipeline.push({ $sort: sortStage });

      // Paginación
      pipeline.push(
        { $skip: (page - 1) * limit },
        { $limit: parseInt(limit) }
      );

      // Proyección
      pipeline.push({
        $project: {
          'userId.password': 0,
          'userId.refreshTokens': 0,
          'userId.verification': 0,
          'userId.passwordReset': 0,
          'bankInfo': 0,
          'documents': 0,
          'earnings': 0
        }
      });

      const professionals = await Professional.aggregate(pipeline);

      // Contar total para paginación
      const countPipeline = pipeline.slice(0, -3); // Remover skip, limit y project
      countPipeline.push({ $count: 'total' });
      const countResult = await Professional.aggregate(countPipeline);
      const total = countResult[0]?.total || 0;

      res.success('Búsqueda de profesionales completada', {
        professionals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        filters: {
          category,
          subcategory,
          location,
          radius,
          minRating,
          maxPrice,
          availability,
          verified,
          sortBy
        }
      });

    } catch (error) {
      logger.error('Error buscando profesionales', {
        error: error.message,
        filters: req.query
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Obtener solicitudes de servicio del profesional
   */
  static async getServiceRequests(req, res) {
    try {
      const user = req.user;
      const { status, page = 1, limit = 10 } = req.query;

      const professional = await Professional.findOne({ userId: user._id });
      if (!professional) {
        return res.notFound('Perfil profesional no encontrado');
      }

      // Construir filtros
      const filters = {
        professional: professional._id
      };

      if (status) {
        filters.status = status;
      }

      // Obtener solicitudes
      const serviceRequests = await ServiceRequest.find(filters)
        .populate('client', 'profile.firstName profile.lastName profile.profilePhoto')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await ServiceRequest.countDocuments(filters);

      res.success('Solicitudes de servicio obtenidas exitosamente', {
        serviceRequests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Error obteniendo solicitudes de servicio', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Enviar cotización
   */
  static async sendQuote(req, res) {
    try {
      const { serviceRequestId } = req.params;
      
      // Validar datos
      const { error, value } = validateData(req.body, quoteSchema);
      if (error) {
        return res.badRequest('Datos de cotización inválidos', { errors: error.details });
      }

      const user = req.user;
      const professional = await Professional.findOne({ userId: user._id });

      if (!professional) {
        return res.notFound('Perfil profesional no encontrado');
      }

      // Buscar solicitud de servicio
      const serviceRequest = await ServiceRequest.findById(serviceRequestId)
        .populate('client', 'profile.firstName profile.lastName email');

      if (!serviceRequest) {
        return res.notFound('Solicitud de servicio no encontrada');
      }

      if (serviceRequest.status !== 'pending') {
        return res.badRequest('La solicitud no está disponible para cotización');
      }

      // Verificar si ya envió una cotización
      const existingQuote = serviceRequest.quotes.find(
        quote => quote.professional.toString() === professional._id.toString()
      );

      if (existingQuote) {
        return res.badRequest('Ya has enviado una cotización para esta solicitud');
      }

      // Agregar cotización
      const quoteData = {
        professional: professional._id,
        ...value,
        createdAt: new Date()
      };

      serviceRequest.quotes.push(quoteData);
      await serviceRequest.save();

      // Enviar notificación al cliente
      await notificationService.sendQuoteReceivedNotification(
        serviceRequest.client,
        {
          serviceRequest,
          professional: {
            name: `${user.profile.firstName} ${user.profile.lastName}`,
            businessName: professional.businessInfo.businessName,
            rating: professional.rating.average
          },
          quote: quoteData
        }
      );

      logger.info('Cotización enviada', {
        userId: user._id,
        professionalId: professional._id,
        serviceRequestId,
        quoteAmount: quoteData.totalCost
      });

      res.created('Cotización enviada exitosamente', {
        quote: quoteData
      });

    } catch (error) {
      logger.error('Error enviando cotización', {
        error: error.message,
        userId: req.user?._id,
        serviceRequestId: req.params.serviceRequestId
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Subir documentos de verificación
   */
  static async uploadVerificationDocuments(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.badRequest('No se proporcionaron documentos');
      }

      const user = req.user;
      const professional = await Professional.findOne({ userId: user._id });

      if (!professional) {
        return res.notFound('Perfil profesional no encontrado');
      }

      // Subir documentos
      const uploadPromises = req.files.map(file => 
        storageService.uploadFile(file, 'verification-documents')
      );

      const uploadResults = await Promise.all(uploadPromises);

      // Actualizar documentos en el perfil
      const documents = uploadResults.map((result, index) => ({
        type: req.body.documentTypes?.[index] || 'other',
        url: result.secure_url,
        publicId: result.public_id,
        uploadedAt: new Date()
      }));

      professional.documents.push(...documents);
      professional.verification.documentsSubmitted = true;
      professional.verification.submittedAt = new Date();
      professional.updatedAt = new Date();
      await professional.save();

      logger.info('Documentos de verificación subidos', {
        userId: user._id,
        professionalId: professional._id,
        documentCount: documents.length
      });

      res.success('Documentos subidos exitosamente', {
        documents: documents.map(doc => ({
          type: doc.type,
          url: doc.url,
          uploadedAt: doc.uploadedAt
        }))
      });

    } catch (error) {
      logger.error('Error subiendo documentos de verificación', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Obtener estadísticas del profesional
   */
  static async getProfessionalStats(req, res) {
    try {
      const user = req.user;
      const professional = await Professional.findOne({ userId: user._id });

      if (!professional) {
        return res.notFound('Perfil profesional no encontrado');
      }

      // Estadísticas de servicios
      const serviceStats = await ServiceRequest.aggregate([
        { $match: { professional: professional._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalEarnings: { $sum: '$pricing.professionalEarnings' }
          }
        }
      ]);

      // Estadísticas por categoría
      const categoryStats = await ServiceRequest.aggregate([
        { $match: { professional: professional._id } },
        {
          $group: {
            _id: '$service.category',
            count: { $sum: 1 },
            totalEarnings: { $sum: '$pricing.professionalEarnings' },
            averageRating: { $avg: '$completion.rating' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Estadísticas mensuales
      const monthlyStats = await ServiceRequest.aggregate([
        { $match: { professional: professional._id } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 },
            earnings: { $sum: '$pricing.professionalEarnings' }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ]);

      // Estadísticas de reseñas
      const reviewStats = await Review.aggregate([
        { $match: { reviewee: user._id } },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$ratings.overall' },
            ratingDistribution: {
              $push: '$ratings.overall'
            }
          }
        }
      ]);

      res.success('Estadísticas obtenidas exitosamente', {
        serviceRequests: {
          byStatus: serviceStats,
          byCategory: categoryStats,
          monthly: monthlyStats
        },
        reviews: reviewStats[0] || {
          totalReviews: 0,
          averageRating: 0,
          ratingDistribution: []
        },
        summary: {
          totalServices: serviceStats.reduce((sum, stat) => sum + stat.count, 0),
          totalEarnings: serviceStats.reduce((sum, stat) => sum + (stat.totalEarnings || 0), 0),
          completionRate: professional.completionRate,
          rating: professional.rating.average,
          isVerified: professional.verification.isVerified
        }
      });

    } catch (error) {
      logger.error('Error obteniendo estadísticas de profesional', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }
}

module.exports = ProfessionalController;