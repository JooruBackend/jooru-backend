const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const logger = require('./logger');

/**
 * Utilidades de autenticación y autorización
 */

class AuthUtils {
  /**
   * Generar hash de contraseña
   * @param {string} password - Contraseña en texto plano
   * @returns {Promise<string>} Hash de la contraseña
   */
  static async hashPassword(password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verificar contraseña
   * @param {string} password - Contraseña en texto plano
   * @param {string} hash - Hash almacenado
   * @returns {Promise<boolean>} True si la contraseña es correcta
   */
  static async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generar token JWT
   * @param {Object} payload - Datos a incluir en el token
   * @param {string} expiresIn - Tiempo de expiración
   * @returns {string} Token JWT
   */
  static generateToken(payload, expiresIn = '24h') {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn,
      issuer: 'proserv-api',
      audience: 'proserv-app'
    });
  }

  /**
   * Generar refresh token
   * @param {Object} payload - Datos a incluir en el token
   * @returns {string} Refresh token
   */
  static generateRefreshToken(payload) {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: '7d',
      issuer: 'proserv-api',
      audience: 'proserv-app'
    });
  }

  /**
   * Verificar token JWT
   * @param {string} token - Token a verificar
   * @param {boolean} isRefreshToken - Si es un refresh token
   * @returns {Object} Payload decodificado
   */
  static verifyToken(token, isRefreshToken = false) {
    const secret = isRefreshToken ? process.env.JWT_REFRESH_SECRET : process.env.JWT_SECRET;
    
    try {
      return jwt.verify(token, secret, {
        issuer: 'proserv-api',
        audience: 'proserv-app'
      });
    } catch (error) {
      throw new Error(`Token inválido: ${error.message}`);
    }
  }

  /**
   * Generar token aleatorio para verificación/reset
   * @param {number} length - Longitud del token
   * @returns {string} Token aleatorio
   */
  static generateRandomToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generar código numérico para verificación
   * @param {number} length - Longitud del código
   * @returns {string} Código numérico
   */
  static generateVerificationCode(length = 6) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  /**
   * Crear hash de token para almacenamiento seguro
   * @param {string} token - Token a hashear
   * @returns {string} Hash del token
   */
  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generar par de tokens (access + refresh)
   * @param {Object} user - Usuario
   * @returns {Object} Par de tokens
   */
  static generateTokenPair(user) {
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      verified: user.isVerified
    };

    const accessToken = this.generateToken(payload, '15m');
    const refreshToken = this.generateRefreshToken({ id: user._id });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 * 1000 // 15 minutos en ms
    };
  }

  /**
   * Extraer token del header Authorization
   * @param {string} authHeader - Header de autorización
   * @returns {string|null} Token extraído
   */
  static extractTokenFromHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Validar fuerza de contraseña
   * @param {string} password - Contraseña a validar
   * @returns {Object} Resultado de validación
   */
  static validatePasswordStrength(password) {
    const minLength = 8;
    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasNoSpaces = !/\s/.test(password);

    const score = [
      password.length >= minLength,
      hasLowerCase,
      hasUpperCase,
      hasNumbers,
      hasSpecialChar,
      hasNoSpaces
    ].filter(Boolean).length;

    let strength = 'muy_debil';
    if (score >= 6) strength = 'muy_fuerte';
    else if (score >= 5) strength = 'fuerte';
    else if (score >= 4) strength = 'media';
    else if (score >= 3) strength = 'debil';

    return {
      isValid: score >= 4,
      strength,
      score,
      requirements: {
        minLength: password.length >= minLength,
        hasLowerCase,
        hasUpperCase,
        hasNumbers,
        hasSpecialChar,
        hasNoSpaces
      }
    };
  }

  /**
   * Generar contraseña temporal
   * @param {number} length - Longitud de la contraseña
   * @returns {string} Contraseña temporal
   */
  static generateTemporaryPassword(length = 12) {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    
    // Asegurar al menos un carácter de cada tipo
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Completar con caracteres aleatorios
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Mezclar los caracteres
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

/**
 * Middleware de autenticación
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = AuthUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.apiUnauthorized('Token de acceso requerido');
    }

    // Verificar token
    const decoded = AuthUtils.verifyToken(token);
    
    // Buscar usuario
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.apiUnauthorized('Usuario no encontrado');
    }

    // Verificar si el usuario está activo
    if (!user.isActive) {
      return res.apiUnauthorized('Cuenta desactivada');
    }

    // Verificar si el token está en la lista negra (opcional)
    if (user.tokenBlacklist && user.tokenBlacklist.includes(token)) {
      return res.apiUnauthorized('Token revocado');
    }

    // Agregar usuario al request
    req.user = user;
    req.token = token;

    // Log de acceso exitoso
    logger.logAuth('token_verification', user._id, true, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl
    });

    next();
  } catch (error) {
    logger.logAuth('token_verification', null, false, {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl
    });

    if (error.name === 'TokenExpiredError') {
      return res.apiTokenExpired();
    }
    
    return res.apiUnauthorized('Token inválido');
  }
};

/**
 * Middleware de autorización por roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.apiUnauthorized('Autenticación requerida');
    }

    if (!roles.includes(req.user.role)) {
      logger.logSecurity('unauthorized_access_attempt', 'medium', req.user._id, {
        requiredRoles: roles,
        userRole: req.user.role,
        endpoint: req.originalUrl,
        ip: req.ip
      });
      
      return res.apiForbidden('No tienes permisos para acceder a este recurso');
    }

    next();
  };
};

/**
 * Middleware para verificar email verificado
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.apiUnauthorized('Autenticación requerida');
  }

  if (!req.user.isVerified) {
    return res.apiUnauthorized('Email no verificado. Verifica tu email para continuar.');
  }

  next();
};

/**
 * Middleware para verificar perfil profesional completo
 */
const requireCompleteProfessionalProfile = async (req, res, next) => {
  if (!req.user) {
    return res.apiUnauthorized('Autenticación requerida');
  }

  if (req.user.role !== 'profesional') {
    return res.apiForbidden('Solo profesionales pueden acceder a este recurso');
  }

  try {
    const Professional = require('../models/Professional');
    const professional = await Professional.findOne({ userId: req.user._id });
    
    if (!professional) {
      return res.apiBadRequest('Perfil profesional no encontrado');
    }

    if (!professional.isProfileComplete) {
      return res.apiBadRequest('Completa tu perfil profesional para continuar');
    }

    if (!professional.isVerified) {
      return res.apiForbidden('Tu perfil profesional aún no está verificado');
    }

    req.professional = professional;
    next();
  } catch (error) {
    logger.logError(error, req);
    return res.apiInternalServerError();
  }
};

/**
 * Middleware de rate limiting por usuario
 */
const rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const now = Date.now();
    const windowStart = now - windowMs;

    // Limpiar requests antiguos
    if (userRequests.has(userId)) {
      const requests = userRequests.get(userId).filter(time => time > windowStart);
      userRequests.set(userId, requests);
    } else {
      userRequests.set(userId, []);
    }

    const requests = userRequests.get(userId);

    if (requests.length >= maxRequests) {
      logger.logSecurity('rate_limit_exceeded', 'medium', userId, {
        requests: requests.length,
        maxRequests,
        windowMs,
        ip: req.ip,
        endpoint: req.originalUrl
      });
      
      return res.apiTooManyRequests('Demasiadas solicitudes. Intenta más tarde.');
    }

    requests.push(now);
    userRequests.set(userId, requests);

    next();
  };
};

/**
 * Middleware para validar propiedad de recurso
 */
const validateResourceOwnership = (resourceModel, resourceIdParam = 'id', userField = 'userId') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      const resource = await resourceModel.findById(resourceId);

      if (!resource) {
        return res.apiNotFound('Recurso no encontrado');
      }

      const resourceUserId = resource[userField]?.toString() || resource[userField];
      const currentUserId = req.user._id.toString();

      // Admins pueden acceder a cualquier recurso
      if (req.user.role === 'admin') {
        req.resource = resource;
        return next();
      }

      // Verificar propiedad
      if (resourceUserId !== currentUserId) {
        logger.logSecurity('unauthorized_resource_access', 'medium', currentUserId, {
          resourceId,
          resourceType: resourceModel.modelName,
          resourceOwner: resourceUserId,
          ip: req.ip
        });
        
        return res.apiForbidden('No tienes permisos para acceder a este recurso');
      }

      req.resource = resource;
      next();
    } catch (error) {
      logger.logError(error, req);
      return res.apiInternalServerError();
    }
  };
};

/**
 * Middleware opcional de autenticación (no falla si no hay token)
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = AuthUtils.extractTokenFromHeader(authHeader);

    if (token) {
      const decoded = AuthUtils.verifyToken(token);
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
        req.token = token;
      }
    }
  } catch (error) {
    // Ignorar errores en autenticación opcional
    logger.debug('Optional authentication failed', { error: error.message });
  }
  
  next();
};

module.exports = {
  AuthUtils,
  authenticate,
  authorize,
  requireEmailVerification,
  requireCompleteProfessionalProfile,
  rateLimitByUser,
  validateResourceOwnership,
  optionalAuthenticate
};