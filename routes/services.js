/**
 * Rutas para gestión de servicios y solicitudes
 * Incluye endpoints para crear, buscar y gestionar solicitudes de servicios
 */

const express = require('express');
const ServiceController = require('../controllers/serviceController');
const { authenticate, authorize } = require('../middleware/authenticate');
const responseMiddleware = require('../middleware/responseMiddleware');
const { searchRateLimit, createResourceRateLimit } = require('../middleware/rateLimitByUser');

const router = express.Router();

// Aplicar middleware de respuesta a todas las rutas
router.use(responseMiddleware);

/**
 * @route   POST /api/services/requests
 * @desc    Crear una nueva solicitud de servicio
 * @access  Private (Solo clientes)
 */
router.post('/requests', 
  authenticate,
  authorize('client'),
  createResourceRateLimit,
  ServiceController.createServiceRequest
);

/**
 * @route   GET /api/services/requests
 * @desc    Obtener solicitudes de servicio con filtros
 * @access  Private
 */
router.get('/requests',
  authenticate,
  ServiceController.getServiceRequests
);

/**
 * @route   GET /api/services/requests/:id
 * @desc    Obtener una solicitud de servicio específica
 * @access  Private
 */
router.get('/requests/:id',
  authenticate,
  ServiceController.getServiceRequestById
);

/**
 * @route   PUT /api/services/requests/:id
 * @desc    Actualizar una solicitud de servicio
 * @access  Private (Solo el cliente propietario)
 */
router.put('/requests/:id',
  authenticate,
  authorize('client'),
  ServiceController.updateServiceRequest
);

/**
 * @route   DELETE /api/services/requests/:id
 * @desc    Cancelar una solicitud de servicio
 * @access  Private (Solo el cliente propietario)
 */
router.delete('/requests/:id',
  authenticate,
  authorize('client'),
  ServiceController.cancelServiceRequest
);

/**
 * @route   GET /api/services/search
 * @desc    Buscar profesionales disponibles
 * @access  Public
 */
router.get('/search',
  searchRateLimit,
  ServiceController.searchProfessionals
);

/**
 * @route   GET /api/services/categories
 * @desc    Obtener categorías de servicios disponibles
 * @access  Public
 */
router.get('/categories', (req, res) => {
  const categories = {
    'home_services': {
      name: 'Servicios del Hogar',
      subcategories: [
        'cleaning',
        'plumbing',
        'electrical',
        'painting',
        'carpentry',
        'gardening',
        'appliance_repair',
        'pest_control',
        'locksmith',
        'hvac'
      ]
    },
    'personal_services': {
      name: 'Servicios Personales',
      subcategories: [
        'beauty',
        'fitness',
        'massage',
        'tutoring',
        'photography',
        'event_planning',
        'catering',
        'pet_care',
        'childcare',
        'elderly_care'
      ]
    },
    'professional_services': {
      name: 'Servicios Profesionales',
      subcategories: [
        'legal',
        'accounting',
        'consulting',
        'marketing',
        'design',
        'translation',
        'writing',
        'it_support',
        'web_development',
        'real_estate'
      ]
    },
    'automotive': {
      name: 'Servicios Automotrices',
      subcategories: [
        'car_repair',
        'car_wash',
        'tire_service',
        'oil_change',
        'car_inspection',
        'towing',
        'car_detailing',
        'auto_glass',
        'car_rental',
        'driving_lessons'
      ]
    },
    'health_wellness': {
      name: 'Salud y Bienestar',
      subcategories: [
        'medical',
        'dental',
        'therapy',
        'nutrition',
        'mental_health',
        'alternative_medicine',
        'rehabilitation',
        'home_healthcare',
        'veterinary',
        'wellness_coaching'
      ]
    },
    'construction': {
      name: 'Construcción y Remodelación',
      subcategories: [
        'general_construction',
        'roofing',
        'flooring',
        'kitchen_remodel',
        'bathroom_remodel',
        'landscaping',
        'fencing',
        'concrete',
        'insulation',
        'windows_doors'
      ]
    }
  };

  res.success(categories, 'Categorías de servicios obtenidas exitosamente');
});

/**
 * @route   GET /api/services/urgency-levels
 * @desc    Obtener niveles de urgencia disponibles
 * @access  Public
 */
router.get('/urgency-levels', (req, res) => {
  const urgencyLevels = {
    'low': {
      name: 'Baja',
      description: 'No es urgente, puede esperar varios días',
      color: '#28a745',
      priority: 1
    },
    'medium': {
      name: 'Media',
      description: 'Moderadamente urgente, preferible en 1-2 días',
      color: '#ffc107',
      priority: 2
    },
    'high': {
      name: 'Alta',
      description: 'Urgente, necesario en el mismo día',
      color: '#fd7e14',
      priority: 3
    },
    'emergency': {
      name: 'Emergencia',
      description: 'Emergencia, necesario inmediatamente',
      color: '#dc3545',
      priority: 4
    }
  };

  res.success(urgencyLevels, 'Niveles de urgencia obtenidos exitosamente');
});

/**
 * @route   GET /api/services/stats
 * @desc    Obtener estadísticas generales de servicios
 * @access  Private (Admin)
 */
router.get('/stats',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const ServiceRequest = require('../models/ServiceRequest');
      const Professional = require('../models/Professional');
      
      const [serviceStats, professionalStats] = await Promise.all([
        ServiceRequest.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
              assigned: { $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] } },
              inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
              completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
              avgBudget: { $avg: '$budget' }
            }
          }
        ]),
        Professional.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              verified: { $sum: { $cond: ['$isVerified', 1, 0] } },
              active: { $sum: { $cond: ['$isActive', 1, 0] } },
              avgRating: { $avg: '$rating' }
            }
          }
        ])
      ]);

      const stats = {
        services: serviceStats[0] || {
          total: 0, open: 0, assigned: 0, inProgress: 0, 
          completed: 0, cancelled: 0, avgBudget: 0
        },
        professionals: professionalStats[0] || {
          total: 0, verified: 0, active: 0, avgRating: 0
        },
        generatedAt: new Date().toISOString()
      };

      res.success(stats, 'Estadísticas obtenidas exitosamente');
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.serverError('Error obteniendo estadísticas');
    }
  }
);

/**
 * @route   GET /api/services/nearby
 * @desc    Obtener servicios cercanos a una ubicación
 * @access  Public
 */
router.get('/nearby',
  searchRateLimit,
  async (req, res) => {
    try {
      const { lat, lng, radius = 10, category, limit = 20 } = req.query;

      if (!lat || !lng) {
        return res.error('Coordenadas de latitud y longitud requeridas', 400);
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.error('Coordenadas inválidas', 400);
      }

      const Professional = require('../models/Professional');
      const query = {
        isVerified: true,
        isActive: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            $maxDistance: parseInt(radius) * 1000 // convertir km a metros
          }
        }
      };

      if (category) {
        query['services.category'] = category;
      }

      const professionals = await Professional.find(query)
        .populate('user', 'firstName lastName')
        .select('businessName services rating reviewCount location')
        .limit(parseInt(limit));

      // Calcular distancia para cada profesional
      const { GeolocationUtils } = require('../utils/geolocation');
      professionals.forEach(prof => {
        if (prof.location && prof.location.coordinates) {
          prof.distance = GeolocationUtils.calculateDistance(
            latitude, longitude,
            prof.location.coordinates[1],
            prof.location.coordinates[0]
          );
        }
      });

      res.success({
        professionals,
        searchLocation: { lat: latitude, lng: longitude },
        radius: parseInt(radius),
        total: professionals.length
      }, 'Servicios cercanos obtenidos exitosamente');

    } catch (error) {
      console.error('Error obteniendo servicios cercanos:', error);
      res.serverError('Error obteniendo servicios cercanos');
    }
  }
);

module.exports = router;