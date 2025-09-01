/**
 * Rutas para funciones administrativas
 * Proporciona endpoints para el panel de administración
 */

const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/authenticate');
const { validateRequest } = require('../middleware/validation');
const { query, param, body } = require('express-validator');
const responseMiddleware = require('../middleware/responseMiddleware');

// Aplicar middleware de respuesta a todas las rutas
router.use(responseMiddleware);

// Middleware para verificar que el usuario sea administrador
const requireAdmin = authorize('admin');

/**
 * @route GET /api/admin/dashboard
 * @desc Obtener estadísticas del dashboard
 * @access Admin
 */
router.get('/dashboard', 
  authenticate,
  requireAdmin,
  AdminController.getDashboardStats
);

/**
 * @route GET /api/admin/users
 * @desc Obtener lista de usuarios para administración
 * @access Admin
 */
router.get('/users',
  authenticate,
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número entero mayor a 0'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe ser entre 1 y 100'),
    query('search').optional().isString().trim(),
    query('role').optional().isIn(['client', 'professional', 'all']).withMessage('Rol inválido'),
    query('status').optional().isIn(['active', 'inactive', 'all']).withMessage('Estado inválido')
  ],
  validateRequest,
  AdminController.getUsers
);

/**
 * @route GET /api/admin/professionals
 * @desc Obtener lista de profesionales para administración
 * @access Admin
 */
router.get('/professionals',
  authenticate,
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número entero mayor a 0'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe ser entre 1 y 100'),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['active', 'inactive', 'pending', 'all']).withMessage('Estado inválido'),
    query('verified').optional().isIn(['true', 'false', 'all']).withMessage('Verificación inválida')
  ],
  validateRequest,
  AdminController.getProfessionals
);

/**
 * @route GET /api/admin/services
 * @desc Obtener lista de solicitudes de servicios para administración
 * @access Admin
 */
router.get('/services',
  authenticate,
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un número entero mayor a 0'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe ser entre 1 y 100'),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['open', 'assigned', 'in_progress', 'completed', 'cancelled', 'all']).withMessage('Estado inválido'),
    query('category').optional().isString().trim()
  ],
  validateRequest,
  AdminController.getServices
);

/**
 * @route GET /api/admin/payments
 * @desc Obtener lista de pagos
 * @access Admin
 */
router.get('/payments',
  authenticate,
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Página inválida'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite inválido'),
    query('search').optional().isString().trim(),
    query('status').optional().isString().trim(),
    query('startDate').optional().isISO8601().withMessage('Fecha de inicio inválida'),
    query('endDate').optional().isISO8601().withMessage('Fecha de fin inválida')
  ],
  validateRequest,
  AdminController.getPayments
);

/**
 * @route GET /api/admin/payments/stats
 * @desc Obtener estadísticas de pagos
 * @access Admin
 */
router.get('/payments/stats',
  authenticate,
  requireAdmin,
  [
    query('startDate').optional().isISO8601().withMessage('Fecha de inicio inválida'),
    query('endDate').optional().isISO8601().withMessage('Fecha de fin inválida'),
    query('groupBy').optional().isIn(['day', 'week', 'month', 'year']).withMessage('Agrupación inválida')
  ],
  validateRequest,
  AdminController.getPaymentStats
);

/**
 * @route GET /api/admin/stats
 * @desc Alias para obtener estadísticas del dashboard (compatibilidad)
 * @access Admin
 */
router.get('/stats',
  authenticate,
  requireAdmin,
  AdminController.getDashboardStats
);

/**
 * @route PUT /api/admin/users/:userId/password
 * @desc Cambiar contraseña de usuario
 * @access Admin
 */
router.put('/users/:userId/password',
  authenticate,
  requireAdmin,
  [
    param('userId').isMongoId().withMessage('ID de usuario inválido'),
    body('newPassword').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
  ],
  validateRequest,
  AdminController.changeUserPassword
);

module.exports = router;