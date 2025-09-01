const express = require('express');
const multer = require('multer');
const UserController = require('../controllers/userController');
const { authenticate, authorize, validateResourceOwnership } = require('../utils/auth');
const { responseMiddleware } = require('../utils/response');
const { storageService } = require('../utils/storage');

const router = express.Router();

// Aplicar middleware de respuesta
router.use(responseMiddleware);

// Configurar multer para subida de archivos
const upload = storageService.configureMulter({
  fileFilter: (req, file, cb) => {
    // Solo permitir imágenes
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

/**
 * @route   GET /api/users/:userId
 * @desc    Obtener perfil de usuario por ID
 * @access  Public
 */
router.get('/:userId', UserController.getUserById);

/**
 * @route   PUT /api/users/profile
 * @desc    Actualizar perfil de usuario
 * @access  Private
 */
router.put('/profile', authenticate, UserController.updateProfile);

/**
 * @route   POST /api/users/profile/photo
 * @desc    Subir foto de perfil
 * @access  Private
 */
router.post('/profile/photo', 
  authenticate, 
  upload.single('profilePhoto'), 
  UserController.uploadProfilePhoto
);

/**
 * @route   POST /api/users/addresses
 * @desc    Agregar dirección
 * @access  Private
 */
router.post('/addresses', authenticate, UserController.addAddress);

/**
 * @route   PUT /api/users/addresses/:addressId
 * @desc    Actualizar dirección
 * @access  Private
 */
router.put('/addresses/:addressId', authenticate, UserController.updateAddress);

/**
 * @route   DELETE /api/users/addresses/:addressId
 * @desc    Eliminar dirección
 * @access  Private
 */
router.delete('/addresses/:addressId', authenticate, UserController.deleteAddress);

/**
 * @route   PUT /api/users/notifications
 * @desc    Actualizar configuración de notificaciones
 * @access  Private
 */
router.put('/notifications', authenticate, UserController.updateNotificationSettings);

/**
 * @route   GET /api/users/service-history
 * @desc    Obtener historial de servicios del usuario
 * @access  Private
 */
router.get('/service-history', authenticate, UserController.getServiceHistory);

/**
 * @route   GET /api/users/:userId/reviews
 * @desc    Obtener reseñas del usuario
 * @access  Public
 */
router.get('/:userId/reviews', UserController.getUserReviews);

/**
 * @route   GET /api/users/search
 * @desc    Buscar usuarios
 * @access  Public
 */
router.get('/search', UserController.searchUsers);

/**
 * @route   GET /api/users/stats/:userId?
 * @desc    Obtener estadísticas del usuario
 * @access  Private (propio usuario o admin)
 */
router.get('/stats/:userId?', authenticate, UserController.getUserStats);

module.exports = router;