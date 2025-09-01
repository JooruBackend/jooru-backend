const User = require('../models/User');
const Professional = require('../models/Professional');
const ServiceRequest = require('../models/ServiceRequest');
const Review = require('../models/Review');
const { validateData } = require('../utils/validation');
const { userProfileUpdateSchema, addressSchema, notificationSettingsSchema } = require('../utils/validation');
const { storageService } = require('../utils/storage');
const { geolocationUtils } = require('../utils/geolocation');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * Controlador de usuarios
 */
class UserController {
  /**
   * Obtener perfil de usuario por ID
   */
  static async getUserById(req, res) {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.badRequest('ID de usuario inválido');
      }

      const user = await User.findById(userId)
        .select('-password -refreshTokens -verification -passwordReset')
        .lean();

      if (!user || !user.isActive) {
        return res.notFound('Usuario no encontrado');
      }

      // Obtener perfil profesional si aplica
      let professional = null;
      if (user.role === 'professional') {
        professional = await Professional.findOne({ userId: user._id })
          .populate('services.reviews', 'rating comment client createdAt')
          .lean();
      }

      res.success('Usuario obtenido exitosamente', {
        user,
        professional: professional ? {
          ...professional,
          completionRate: professional.completionRate,
          isCurrentlyAvailable: professional.isCurrentlyAvailable
        } : null
      });

    } catch (error) {
      logger.error('Error obteniendo usuario por ID', {
        error: error.message,
        userId: req.params.userId
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Actualizar perfil de usuario
   */
  static async updateProfile(req, res) {
    try {
      // Validar datos
      const { error, value } = validateData(req.body, userProfileUpdateSchema);
      if (error) {
        return res.badRequest('Datos inválidos', { errors: error.details });
      }

      const user = req.user;
      const updateData = { ...value };

      // Actualizar campos permitidos
      const allowedFields = ['profile', 'preferences', 'addresses'];
      allowedFields.forEach(field => {
        if (updateData[field]) {
          if (field === 'profile') {
            user.profile = { ...user.profile, ...updateData[field] };
          } else if (field === 'preferences') {
            user.preferences = { ...user.preferences, ...updateData[field] };
          } else if (field === 'addresses') {
            user.addresses = updateData[field];
          }
        }
      });

      user.updatedAt = new Date();
      await user.save();

      logger.info('Perfil de usuario actualizado', {
        userId: user._id,
        updatedFields: Object.keys(updateData)
      });

      res.success('Perfil actualizado exitosamente', {
        user: user.getPublicProfile()
      });

    } catch (error) {
      logger.error('Error actualizando perfil', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Subir foto de perfil
   */
  static async uploadProfilePhoto(req, res) {
    try {
      if (!req.file) {
        return res.badRequest('No se proporcionó ninguna imagen');
      }

      const user = req.user;

      // Subir imagen
      const uploadResult = await storageService.uploadFile(
        req.file,
        'profile-photos',
        {
          transformation: {
            width: 400,
            height: 400,
            crop: 'fill',
            quality: 'auto'
          }
        }
      );

      // Eliminar foto anterior si existe
      if (user.profile.profilePhoto && user.profile.profilePhoto.publicId) {
        await storageService.deleteFile(user.profile.profilePhoto.publicId);
      }

      // Actualizar usuario
      user.profile.profilePhoto = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id
      };
      user.updatedAt = new Date();
      await user.save();

      logger.info('Foto de perfil actualizada', {
        userId: user._id,
        photoUrl: uploadResult.secure_url
      });

      res.success('Foto de perfil actualizada exitosamente', {
        profilePhoto: user.profile.profilePhoto
      });

    } catch (error) {
      logger.error('Error subiendo foto de perfil', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Agregar dirección
   */
  static async addAddress(req, res) {
    try {
      // Validar datos
      const { error, value } = validateData(req.body, addressSchema);
      if (error) {
        return res.badRequest('Datos de dirección inválidos', { errors: error.details });
      }

      const user = req.user;
      const addressData = { ...value };

      // Geocodificar dirección si no tiene coordenadas
      if (!addressData.coordinates && addressData.fullAddress) {
        try {
          const geocodeResult = await geolocationUtils.geocodeAddress(addressData.fullAddress);
          if (geocodeResult) {
            addressData.coordinates = {
              type: 'Point',
              coordinates: [geocodeResult.lng, geocodeResult.lat]
            };
          }
        } catch (geocodeError) {
          logger.warn('Error geocodificando dirección', {
            error: geocodeError.message,
            address: addressData.fullAddress
          });
        }
      }

      // Agregar ID único a la dirección
      addressData._id = new mongoose.Types.ObjectId();
      addressData.createdAt = new Date();

      user.addresses.push(addressData);
      user.updatedAt = new Date();
      await user.save();

      logger.info('Dirección agregada', {
        userId: user._id,
        addressId: addressData._id,
        type: addressData.type
      });

      res.created('Dirección agregada exitosamente', {
        address: addressData
      });

    } catch (error) {
      logger.error('Error agregando dirección', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Actualizar dirección
   */
  static async updateAddress(req, res) {
    try {
      const { addressId } = req.params;
      
      // Validar datos
      const { error, value } = validateData(req.body, addressSchema);
      if (error) {
        return res.badRequest('Datos de dirección inválidos', { errors: error.details });
      }

      const user = req.user;
      const addressIndex = user.addresses.findIndex(
        addr => addr._id.toString() === addressId
      );

      if (addressIndex === -1) {
        return res.notFound('Dirección no encontrada');
      }

      const updateData = { ...value };

      // Geocodificar dirección si cambió
      if (updateData.fullAddress && updateData.fullAddress !== user.addresses[addressIndex].fullAddress) {
        try {
          const geocodeResult = await geolocationUtils.geocodeAddress(updateData.fullAddress);
          if (geocodeResult) {
            updateData.coordinates = {
              type: 'Point',
              coordinates: [geocodeResult.lng, geocodeResult.lat]
            };
          }
        } catch (geocodeError) {
          logger.warn('Error geocodificando dirección actualizada', {
            error: geocodeError.message,
            address: updateData.fullAddress
          });
        }
      }

      // Actualizar dirección
      user.addresses[addressIndex] = {
        ...user.addresses[addressIndex].toObject(),
        ...updateData,
        updatedAt: new Date()
      };
      user.updatedAt = new Date();
      await user.save();

      logger.info('Dirección actualizada', {
        userId: user._id,
        addressId,
        updatedFields: Object.keys(updateData)
      });

      res.success('Dirección actualizada exitosamente', {
        address: user.addresses[addressIndex]
      });

    } catch (error) {
      logger.error('Error actualizando dirección', {
        error: error.message,
        userId: req.user?._id,
        addressId: req.params.addressId
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Eliminar dirección
   */
  static async deleteAddress(req, res) {
    try {
      const { addressId } = req.params;
      const user = req.user;

      const addressIndex = user.addresses.findIndex(
        addr => addr._id.toString() === addressId
      );

      if (addressIndex === -1) {
        return res.notFound('Dirección no encontrada');
      }

      user.addresses.splice(addressIndex, 1);
      user.updatedAt = new Date();
      await user.save();

      logger.info('Dirección eliminada', {
        userId: user._id,
        addressId
      });

      res.success('Dirección eliminada exitosamente');

    } catch (error) {
      logger.error('Error eliminando dirección', {
        error: error.message,
        userId: req.user?._id,
        addressId: req.params.addressId
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Actualizar configuración de notificaciones
   */
  static async updateNotificationSettings(req, res) {
    try {
      // Validar datos
      const { error, value } = validateData(req.body, notificationSettingsSchema);
      if (error) {
        return res.badRequest('Configuración de notificaciones inválida', { errors: error.details });
      }

      const user = req.user;
      user.preferences.notifications = { ...user.preferences.notifications, ...value };
      user.updatedAt = new Date();
      await user.save();

      logger.info('Configuración de notificaciones actualizada', {
        userId: user._id,
        settings: value
      });

      res.success('Configuración de notificaciones actualizada exitosamente', {
        notifications: user.preferences.notifications
      });

    } catch (error) {
      logger.error('Error actualizando configuración de notificaciones', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Obtener historial de servicios del usuario
   */
  static async getServiceHistory(req, res) {
    try {
      const user = req.user;
      const { page = 1, limit = 10, status, category } = req.query;

      // Construir filtros
      const filters = {
        client: user._id
      };

      if (status) {
        filters.status = status;
      }

      if (category) {
        filters['service.category'] = category;
      }

      // Obtener solicitudes de servicio
      const serviceRequests = await ServiceRequest.find(filters)
        .populate('professional', 'profile.firstName profile.lastName profile.profilePhoto businessInfo.businessName rating.average')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await ServiceRequest.countDocuments(filters);

      res.success('Historial de servicios obtenido exitosamente', {
        serviceRequests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Error obteniendo historial de servicios', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Obtener reseñas del usuario
   */
  static async getUserReviews(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10, type = 'received' } = req.query;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.badRequest('ID de usuario inválido');
      }

      // Construir filtros según el tipo de reseñas
      const filters = {};
      if (type === 'received') {
        filters.reviewee = userId;
      } else if (type === 'given') {
        filters.reviewer = userId;
      } else {
        return res.badRequest('Tipo de reseña inválido. Use "received" o "given"');
      }

      filters.isPublic = true;
      filters.moderationStatus = 'approved';

      // Obtener reseñas
      const reviews = await Review.find(filters)
        .populate('reviewer', 'profile.firstName profile.lastName profile.profilePhoto')
        .populate('reviewee', 'profile.firstName profile.lastName profile.profilePhoto')
        .populate('serviceRequest', 'service.title service.category')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await Review.countDocuments(filters);

      // Calcular estadísticas
      const stats = await Review.aggregate([
        { $match: filters },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$ratings.overall' },
            totalReviews: { $sum: 1 },
            ratingDistribution: {
              $push: '$ratings.overall'
            }
          }
        }
      ]);

      const statistics = stats[0] || {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: []
      };

      // Calcular distribución de calificaciones
      const distribution = [1, 2, 3, 4, 5].map(rating => ({
        rating,
        count: statistics.ratingDistribution.filter(r => Math.floor(r) === rating).length
      }));

      res.success('Reseñas obtenidas exitosamente', {
        reviews,
        statistics: {
          ...statistics,
          ratingDistribution: distribution
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Error obteniendo reseñas de usuario', {
        error: error.message,
        userId: req.params.userId
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Buscar usuarios
   */
  static async searchUsers(req, res) {
    try {
      const { q, role, location, page = 1, limit = 10 } = req.query;

      if (!q || q.trim().length < 2) {
        return res.badRequest('Término de búsqueda debe tener al menos 2 caracteres');
      }

      // Construir filtros
      const filters = {
        isActive: true,
        $or: [
          { 'profile.firstName': { $regex: q, $options: 'i' } },
          { 'profile.lastName': { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } }
        ]
      };

      if (role) {
        filters.role = role;
      }

      // Búsqueda por ubicación
      if (location) {
        const [lat, lng] = location.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          filters['addresses.coordinates'] = {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [lng, lat]
              },
              $maxDistance: 50000 // 50km
            }
          };
        }
      }

      // Buscar usuarios
      const users = await User.find(filters)
        .select('-password -refreshTokens -verification -passwordReset')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await User.countDocuments(filters);

      // Obtener perfiles profesionales si aplica
      const userIds = users.filter(u => u.role === 'professional').map(u => u._id);
      const professionals = await Professional.find({ userId: { $in: userIds } })
        .select('userId businessInfo rating completionRate')
        .lean();

      // Combinar datos
      const results = users.map(user => {
        const professional = professionals.find(p => p.userId.toString() === user._id.toString());
        return {
          ...user,
          professional: professional ? {
            businessName: professional.businessInfo.businessName,
            rating: professional.rating.average,
            completionRate: professional.completionRate
          } : null
        };
      });

      res.success('Búsqueda de usuarios completada', {
        users: results,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Error buscando usuarios', {
        error: error.message,
        query: req.query.q
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Obtener estadísticas del usuario
   */
  static async getUserStats(req, res) {
    try {
      const user = req.user;
      const { userId } = req.params;
      
      // Verificar si es el propio usuario o admin
      const targetUserId = userId || user._id;
      if (userId && userId !== user._id.toString() && user.role !== 'admin') {
        return res.forbidden('No tienes permisos para ver estas estadísticas');
      }

      // Estadísticas de solicitudes de servicio
      const serviceStats = await ServiceRequest.aggregate([
        { $match: { client: new mongoose.Types.ObjectId(targetUserId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalSpent: { $sum: '$pricing.finalCost' }
          }
        }
      ]);

      // Estadísticas de reseñas
      const reviewStats = await Review.aggregate([
        { $match: { reviewer: new mongoose.Types.ObjectId(targetUserId) } },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRatingGiven: { $avg: '$ratings.overall' }
          }
        }
      ]);

      // Servicios más utilizados
      const topServices = await ServiceRequest.aggregate([
        { $match: { client: new mongoose.Types.ObjectId(targetUserId) } },
        {
          $group: {
            _id: '$service.category',
            count: { $sum: 1 },
            totalSpent: { $sum: '$pricing.finalCost' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);

      res.success('Estadísticas obtenidas exitosamente', {
        serviceRequests: {
          byStatus: serviceStats,
          topCategories: topServices
        },
        reviews: reviewStats[0] || {
          totalReviews: 0,
          averageRatingGiven: 0
        },
        summary: {
          totalServices: serviceStats.reduce((sum, stat) => sum + stat.count, 0),
          totalSpent: serviceStats.reduce((sum, stat) => sum + (stat.totalSpent || 0), 0),
          memberSince: user.createdAt
        }
      });

    } catch (error) {
      logger.error('Error obteniendo estadísticas de usuario', {
        error: error.message,
        userId: req.params.userId || req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }
}

module.exports = UserController;