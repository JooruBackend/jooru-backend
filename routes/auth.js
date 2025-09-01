const express = require('express');
const multer = require('multer');
const AuthController = require('../controllers/authController');
const { authenticate, optionalAuthenticate } = require('../middleware/authenticate');
const { rateLimitByUser } = require('../utils/auth');
const { responseMiddleware } = require('../utils/response');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Aplicar middleware de respuesta
router.use(responseMiddleware);

// Rate limiting para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos por IP
  message: {
    error: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 intentos por IP
  message: {
    error: 'Demasiados intentos de recuperación de contraseña. Intenta de nuevo en 1 hora.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * @route   POST /api/auth/register
 * @desc    Registrar nuevo usuario
 * @access  Public
 */
router.post('/register', /* authLimiter, */ AuthController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión
 * @access  Public
 */
router.post('/login', /* authLimiter, */ AuthController.login);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Renovar token de acceso
 * @access  Public
 */
router.post('/refresh-token', AuthController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Cerrar sesión
 * @access  Private
 */
router.post('/logout', authenticate, AuthController.logout);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verificar email con token
 * @access  Public
 */
router.post('/verify-email', AuthController.verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Reenviar email de verificación
 * @access  Private
 */
router.post('/resend-verification', authenticate, AuthController.resendVerificationEmail);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Solicitar recuperación de contraseña
 * @access  Public
 */
router.post('/forgot-password', passwordResetLimiter, AuthController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Restablecer contraseña con token
 * @access  Public
 */
router.post('/reset-password', AuthController.resetPassword);

/**
 * @route   POST /api/auth/change-password
 * @desc    Cambiar contraseña (usuario autenticado)
 * @access  Private
 */
router.post('/change-password', authenticate, AuthController.changePassword);

/**
 * @route   GET /api/auth/profile
 * @desc    Obtener perfil del usuario autenticado
 * @access  Private
 */
router.get('/profile', authenticate, AuthController.getProfile);

/**
 * @route   PUT /api/auth/device-token
 * @desc    Actualizar device token para notificaciones push
 * @access  Private
 */
router.put('/device-token', authenticate, AuthController.updateDeviceToken);

/**
 * @route   DELETE /api/auth/account
 * @desc    Eliminar cuenta de usuario
 * @access  Private
 */
router.delete('/account', authenticate, AuthController.deleteAccount);

module.exports = router;