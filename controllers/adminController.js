/**
 * Controlador para funciones administrativas
 * Proporciona estadísticas y datos del dashboard para el panel de administración
 */

const User = require('../models/User');
const Professional = require('../models/Professional');
const ServiceRequest = require('../models/ServiceRequest');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

class AdminController {
  /**
   * Obtener estadísticas del dashboard
   */
  static async getDashboardStats(req, res) {
    try {
      // Obtener conteos totales
      const [totalUsers, totalProfessionals, totalServiceRequests, totalPayments, totalReviews] = await Promise.all([
        User.countDocuments({ role: { $ne: 'admin' } }),
        Professional.countDocuments(),
        ServiceRequest.countDocuments(),
        Payment.countDocuments(),
        Review.countDocuments()
      ]);

      // Calcular ingresos totales (pagos completados)
      const revenueStats = await Payment.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            totalPlatformFees: { $sum: '$platformFee' }
          }
        }
      ]);

      const totalRevenue = revenueStats[0]?.totalRevenue || 0;
      const totalPlatformFees = revenueStats[0]?.totalPlatformFees || 0;

      // Calcular calificación promedio
      const ratingStats = await Review.aggregate([
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating.overall' }
          }
        }
      ]);

      const averageRating = ratingStats[0]?.averageRating || 0;

      // Obtener actividad reciente (últimos 6 meses)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const recentActivity = await User.aggregate([
        {
          $match: {
            createdAt: { $gte: sixMonthsAgo },
            role: { $ne: 'admin' }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            users: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'professionals',
            let: { year: '$_id.year', month: '$_id.month' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: [{ $year: '$createdAt' }, '$$year'] },
                      { $eq: [{ $month: '$createdAt' }, '$$month'] }
                    ]
                  }
                }
              },
              { $count: 'count' }
            ],
            as: 'professionalData'
          }
        },
        {
          $addFields: {
            professionals: { $ifNull: [{ $arrayElemAt: ['$professionalData.count', 0] }, 0] }
          }
        },
        {
          $project: {
            date: {
              $dateToString: {
                format: '%Y-%m',
                date: {
                  $dateFromParts: {
                    year: '$_id.year',
                    month: '$_id.month'
                  }
                }
              }
            },
            users: 1,
            professionals: 1
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      // Estadísticas adicionales
      const additionalStats = await Promise.all([
        // Usuarios activos (con al menos una solicitud en los últimos 30 días)
        ServiceRequest.distinct('client', {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }),
        // Profesionales verificados
        Professional.countDocuments({ 'verification.isVerified': true }),
        // Servicios completados
        ServiceRequest.countDocuments({ status: 'completed' }),
        // Servicios pendientes
        ServiceRequest.countDocuments({ status: 'pending' })
      ]);

      const [activeUsers, verifiedProfessionals, completedServices, pendingServices] = additionalStats;

      // Obtener distribución de servicios por categoría
      const serviceDistribution = await ServiceRequest.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            name: '$_id',
            value: '$count',
            color: {
              $switch: {
                branches: [
                  { case: { $eq: ['$_id', 'plomeria'] }, then: '#1976d2' },
                  { case: { $eq: ['$_id', 'electricidad'] }, then: '#2e7d32' },
                  { case: { $eq: ['$_id', 'limpieza'] }, then: '#ed6c02' },
                  { case: { $eq: ['$_id', 'jardineria'] }, then: '#9c27b0' },
                  { case: { $eq: ['$_id', 'carpinteria'] }, then: '#d32f2f' }
                ],
                default: '#757575'
              }
            }
          }
        }
      ]);

      // Obtener reservas mensuales (últimos 6 meses)
      const monthlyBookings = await ServiceRequest.aggregate([
        {
          $match: {
            createdAt: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            bookings: { $sum: 1 }
          }
        },
        {
          $project: {
            month: {
              $dateToString: {
                format: '%Y-%m',
                date: {
                  $dateFromParts: {
                    year: '$_id.year',
                    month: '$_id.month'
                  }
                }
              }
            },
            bookings: 1
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      const dashboardData = {
        totalUsers,
        totalProfessionals,
        totalRevenue: Math.round(totalRevenue),
        averageRating: Math.round(averageRating * 10) / 10,
        recentActivity,
        serviceDistribution,
        monthlyBookings,
        additionalStats: {
          activeUsers: activeUsers.length,
          verifiedProfessionals,
          completedServices,
          pendingServices,
          totalServiceRequests,
          totalPayments,
          totalReviews,
          totalPlatformFees: Math.round(totalPlatformFees)
        }
      };

      res.success('Estadísticas del dashboard obtenidas exitosamente', dashboardData);

    } catch (error) {
      logger.error('Error obteniendo estadísticas del dashboard', {
        error: error.message,
        stack: error.stack
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Obtener lista de usuarios para administración
   */
  static async getUsers(req, res) {
    try {
      const { page = 1, limit = 10, search, role, status } = req.query;
      const skip = (page - 1) * limit;

      // Construir filtros
      let filters = { role: { $ne: 'admin' } };
      
      if (search) {
        filters.$or = [
          { 'profile.firstName': { $regex: search, $options: 'i' } },
          { 'profile.lastName': { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (role && role !== 'all') {
        filters.role = role;
      }
      
      if (status && status !== 'all') {
        filters.isActive = status === 'active';
      }

      const [users, total] = await Promise.all([
        User.find(filters)
          .select('profile email role isActive isVerified createdAt lastLogin')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        User.countDocuments(filters)
      ]);

      res.success('Usuarios obtenidos exitosamente', {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Error obteniendo usuarios', {
        error: error.message,
        stack: error.stack
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Obtener lista de profesionales para administración
   */
  static async getProfessionals(req, res) {
    try {
      const { page = 1, limit = 10, search, status, verified } = req.query;
      const skip = (page - 1) * limit;

      // Construir filtros
      let filters = {};
      
      if (status && status !== 'all') {
        filters.status = status;
      }
      
      if (verified && verified !== 'all') {
        filters['verification.isVerified'] = verified === 'true';
      }

      let aggregationPipeline = [
        { $match: filters },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' }
      ];

      if (search) {
        aggregationPipeline.push({
          $match: {
            $or: [
              { 'user.profile.firstName': { $regex: search, $options: 'i' } },
              { 'user.profile.lastName': { $regex: search, $options: 'i' } },
              { 'user.email': { $regex: search, $options: 'i' } },
              { 'services.title': { $regex: search, $options: 'i' } }
            ]
          }
        });
      }

      aggregationPipeline.push(
        {
          $project: {
            userId: 1,
            status: 1,
            verification: 1,
            rating: 1,
            services: 1,
            createdAt: 1,
            'user.profile': 1,
            'user.email': 1,
            'user.isActive': 1
          }
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) }
      );

      const [professionals, totalResult] = await Promise.all([
        Professional.aggregate(aggregationPipeline),
        Professional.aggregate([
          { $match: filters },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user'
            }
          },
          { $unwind: '$user' },
          ...(search ? [{
            $match: {
              $or: [
                { 'user.profile.firstName': { $regex: search, $options: 'i' } },
                { 'user.profile.lastName': { $regex: search, $options: 'i' } },
                { 'user.email': { $regex: search, $options: 'i' } },
                { 'services.title': { $regex: search, $options: 'i' } }
              ]
            }
          }] : []),
          { $count: 'total' }
        ])
      ]);

      const total = totalResult[0]?.total || 0;

      res.success('Profesionales obtenidos exitosamente', {
        professionals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('Error obteniendo profesionales', {
        error: error.message,
        stack: error.stack
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Obtener lista de pagos para administración
   */
  static async getPayments(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const search = req.query.search || '';
      const status = req.query.status;
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      // Construir query
      let query = {};

      // Filtro por estado
      if (status && status !== 'all') {
        query.status = status;
      }

      // Filtro por fechas
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      // Filtro por búsqueda (ID de transacción, email del usuario)
      if (search) {
        query.$or = [
          { transactionId: { $regex: search, $options: 'i' } },
          { 'paymentMethod.type': { $regex: search, $options: 'i' } }
        ];
      }

      // Obtener total y pagos
      const total = await Payment.countDocuments(query);
      const payments = await Payment.find(query)
        .populate('serviceRequest', 'service.title service.category')
        .populate('client', 'profile.firstName profile.lastName email')
        .populate('professional', 'profile.firstName profile.lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const pagination = {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      };

      res.success({
        payments,
        pagination
      }, 'Pagos obtenidos exitosamente');

    } catch (error) {
      logger.error('Error obteniendo pagos para administración', {
        error: error.message,
        stack: error.stack
      });
      res.serverError('Error obteniendo pagos');
    }
  }

  /**
   * Obtener estadísticas de pagos
   */
  static async getPaymentStats(req, res) {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;
      
      let matchQuery = {};
      if (startDate || endDate) {
        matchQuery.createdAt = {};
        if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
        if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
      }

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
            avgPaymentAmount: { $avg: '$totalAmount' }
          }
        }
      ]);

      res.success({
        general: generalStats[0] || {
          totalPayments: 0,
          completedPayments: 0,
          totalRevenue: 0,
          totalPlatformFees: 0,
          avgPaymentAmount: 0
        }
      }, 'Estadísticas de pagos obtenidas exitosamente');

    } catch (error) {
      logger.error('Error obteniendo estadísticas de pagos', {
        error: error.message,
        stack: error.stack
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Obtener lista de solicitudes de servicios para administración
   */
  static async getServices(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const search = req.query.search || '';
      const status = req.query.status;
      const category = req.query.category;

      // Construir query
      let query = {};

      // Filtro por estado
      if (status && status !== 'all') {
        query.status = status;
      }

      // Filtro por categoría
      if (category) {
        query['service.category'] = category;
      }

      // Filtro por búsqueda
      if (search) {
        query.$or = [
          { 'service.title': { $regex: search, $options: 'i' } },
          { 'service.description': { $regex: search, $options: 'i' } },
          { 'service.category': { $regex: search, $options: 'i' } },
          { 'service.subcategory': { $regex: search, $options: 'i' } }
        ];
      }

      // Obtener total y servicios
      const total = await ServiceRequest.countDocuments(query);
      const services = await ServiceRequest.find(query)
        .populate('clientId', 'profile.firstName profile.lastName email')
        .populate('professionalId', 'profile.firstName profile.lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const pagination = {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      };

      res.success({
        services,
        pagination
      }, 'Servicios obtenidos exitosamente');

    } catch (error) {
      logger.error('Error obteniendo servicios para administración', {
        error: error.message,
        stack: error.stack
      });
      res.serverError('Error obteniendo servicios');
    }
  }

  /**
   * Cambiar contraseña de usuario
   */
  static async changeUserPassword(req, res) {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;

      // Validar que se proporcione la nueva contraseña
      if (!newPassword) {
        return res.badRequest('La nueva contraseña es requerida');
      }

      // Validar longitud mínima de contraseña
      if (newPassword.length < 8) {
        return res.badRequest('La contraseña debe tener al menos 8 caracteres');
      }

      // Buscar el usuario
      const user = await User.findById(userId);
      if (!user) {
        return res.notFound('Usuario no encontrado');
      }

      // Hashear la nueva contraseña
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Actualizar la contraseña
      await User.findByIdAndUpdate(userId, {
        password: hashedPassword
      });

      logger.info('Contraseña de usuario actualizada por administrador', {
        adminId: req.user.id,
        targetUserId: userId,
        userEmail: user.email
      });

      res.success({
        message: 'Contraseña actualizada exitosamente'
      }, 'Contraseña actualizada exitosamente');

    } catch (error) {
      logger.error('Error cambiando contraseña de usuario', {
        error: error.message,
        stack: error.stack,
        userId: req.params.userId
      });
      res.serverError('Error cambiando contraseña');
    }
  }
}

module.exports = AdminController;