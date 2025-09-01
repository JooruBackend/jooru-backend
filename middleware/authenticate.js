/**
 * Middleware de autenticación para verificar tokens JWT
 * Proporciona autenticación obligatoria y opcional
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Middleware de autenticación obligatoria
 * Verifica que el usuario esté autenticado y el token sea válido
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const authenticate = async (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.unauthorized('Token de acceso requerido');
    }

    const token = authHeader.substring(7); // Remover 'Bearer '

    if (!token) {
      return res.unauthorized('Token de acceso requerido');
    }

    try {
      // Verificar y decodificar el token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Buscar el usuario en la base de datos
      const user = await User.findById(decoded.userId)
        .select('-password');

      if (!user) {
        return res.unauthorized('Usuario no encontrado');
      }

      // Verificar si el usuario está activo
      if (!user.isActive) {
        return res.unauthorized('Cuenta desactivada');
      }

      // Verificar si el email está verificado (solo para usuarios no admin)
      if (user.role !== 'admin' && !user.isVerified) {
        return res.unauthorized('Email no verificado');
      }

      // Añadir información del usuario al request
      req.user = user;
      req.token = token;
      req.userId = user._id;
      req.userRole = user.role;

      // Log de autenticación exitosa
      logger.info('Usuario autenticado:', {
        userId: user._id,
        email: user.email,
        role: user.role,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl
      });

      next();

    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.unauthorized('Token expirado');
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.unauthorized('Token inválido');
      } else {
        throw jwtError;
      }
    }

  } catch (error) {
    logger.error('Error en autenticación:', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      endpoint: req.originalUrl
    });
    
    return res.serverError('Error en la autenticación');
  }
};

/**
 * Middleware de autenticación opcional
 * Verifica el token si está presente, pero no requiere autenticación
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    // Si no hay token, continuar sin autenticación
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    if (!token) {
      return next();
    }

    try {
      // Verificar y decodificar el token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Buscar el usuario en la base de datos
      const user = await User.findById(decoded.userId)
        .select('-password');

      if (user && user.isActive && (user.role === 'admin' || user.isVerified)) {
        // Añadir información del usuario al request
        req.user = user;
        req.token = token;
        req.userId = user._id;
        req.userRole = user.role;

        logger.info('Usuario autenticado opcionalmente:', {
          userId: user._id,
          email: user.email,
          role: user.role,
          endpoint: req.originalUrl
        });
      }

    } catch (jwtError) {
      // En autenticación opcional, ignorar errores de token
      logger.warn('Token inválido en autenticación opcional:', {
        error: jwtError.message,
        endpoint: req.originalUrl
      });
    }

    next();

  } catch (error) {
    logger.error('Error en autenticación opcional:', {
      error: error.message,
      stack: error.stack,
      endpoint: req.originalUrl
    });
    
    // En autenticación opcional, continuar sin autenticación en caso de error
    next();
  }
};

/**
 * Middleware de autorización por roles
 * Verifica que el usuario tenga uno de los roles permitidos
 * @param {...string} allowedRoles - Roles permitidos
 * @returns {Function} Middleware function
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Verificar que el usuario esté autenticado
    if (!req.user) {
      return res.unauthorized('Autenticación requerida');
    }

    // Verificar que el usuario tenga un rol permitido
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Acceso denegado por rol:', {
        userId: req.user._id,
        userRole: req.user.role,
        allowedRoles,
        endpoint: req.originalUrl
      });
      
      return res.forbidden('No tienes permisos para acceder a este recurso');
    }

    logger.info('Autorización exitosa:', {
      userId: req.user._id,
      userRole: req.user.role,
      endpoint: req.originalUrl
    });

    next();
  };
};

/**
 * Middleware para verificar que el usuario sea propietario del recurso
 * @param {string} paramName - Nombre del parámetro que contiene el ID del propietario
 * @returns {Function} Middleware function
 */
const requireOwnership = (paramName = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.unauthorized('Autenticación requerida');
    }

    const resourceOwnerId = req.params[paramName] || req.body[paramName];
    
    if (!resourceOwnerId) {
      return res.error('ID de propietario requerido', 400);
    }

    // Verificar que el usuario sea el propietario o sea admin
    if (req.user._id.toString() !== resourceOwnerId.toString() && req.user.role !== 'admin') {
      logger.warn('Acceso denegado - no es propietario:', {
        userId: req.user._id,
        resourceOwnerId,
        endpoint: req.originalUrl
      });
      
      return res.forbidden('Solo puedes acceder a tus propios recursos');
    }

    next();
  };
};

/**
 * Middleware para verificar que el usuario sea profesional verificado
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const requireVerifiedProfessional = (req, res, next) => {
  if (!req.user) {
    return res.unauthorized('Autenticación requerida');
  }

  if (req.user.role !== 'professional') {
    return res.forbidden('Solo profesionales pueden acceder a este recurso');
  }

  if (!req.user.professional || !req.user.professional.isVerified) {
    return res.forbidden('Perfil profesional no verificado');
  }

  next();
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  requireOwnership,
  requireVerifiedProfessional
};