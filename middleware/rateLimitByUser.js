/**
 * Middleware de rate limiting por usuario
 * Implementa límites de velocidad específicos por usuario autenticado
 */

const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');
const logger = require('../utils/logger');

// Configurar Redis si está disponible
let redisClient = null;
if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 1,
      lazyConnect: true
    });
    
    redisClient.on('error', (err) => {
      logger.warn('Error de Redis, continuando sin cache:', err.message);
      redisClient = null;
    });
    
    logger.info('Redis configurado para rate limiting');
  } catch (error) {
    logger.warn('No se pudo configurar Redis, usando memoria local:', error.message);
    redisClient = null;
  }
} else {
  logger.info('Redis no configurado, usando memoria local para rate limiting');
}

/**
 * Crea un rate limiter específico por usuario
 * @param {Object} options - Opciones de configuración
 * @param {number} options.windowMs - Ventana de tiempo en milisegundos
 * @param {number} options.max - Máximo número de requests por ventana
 * @param {string} options.message - Mensaje de error personalizado
 * @param {Function} options.keyGenerator - Función para generar la clave única
 * @returns {Function} Middleware de rate limiting
 */
const createUserRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutos por defecto
    max = 100, // 100 requests por defecto
    message = 'Demasiadas solicitudes, intenta de nuevo más tarde',
    keyGenerator = null,
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  const rateLimitConfig = {
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    skipFailedRequests,
    keyGenerator: keyGenerator || ((req) => {
      // Usar ID de usuario si está autenticado, sino usar IP
      return req.user ? `user:${req.user._id}` : `ip:${req.ip}`;
    }),
    handler: (req, res) => {
      const identifier = req.user ? `Usuario ${req.user._id}` : `IP ${req.ip}`;
      
      logger.warn('Rate limit excedido:', {
        identifier,
        endpoint: req.originalUrl,
        method: req.method,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      return res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString()
      });
    }
  };

  // Usar Redis store si está disponible
  if (redisClient) {
    rateLimitConfig.store = new RedisStore({
      sendCommand: (command, ...args) => redisClient.call(command, ...args),
      prefix: 'rl:user:'
    });
  }

  return rateLimit(rateLimitConfig);
};

/**
 * Rate limiter para autenticación (más restrictivo)
 */
const authRateLimit = createUserRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos de login por usuario/IP
  message: 'Demasiados intentos de autenticación, intenta de nuevo en 15 minutos',
  keyGenerator: (req) => {
    // Para login, usar email si está disponible, sino IP
    const email = req.body?.email;
    return email ? `auth:email:${email}` : `auth:ip:${req.ip}`;
  }
});

/**
 * Rate limiter para reset de contraseña
 */
const passwordResetRateLimit = createUserRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 intentos por hora
  message: 'Demasiados intentos de reset de contraseña, intenta de nuevo en 1 hora',
  keyGenerator: (req) => {
    const email = req.body?.email;
    return email ? `reset:email:${email}` : `reset:ip:${req.ip}`;
  }
});

/**
 * Rate limiter para verificación de email
 */
const emailVerificationRateLimit = createUserRateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 3, // 3 intentos por 10 minutos
  message: 'Demasiados intentos de verificación de email, intenta de nuevo en 10 minutos'
});

/**
 * Rate limiter para búsquedas
 */
const searchRateLimit = createUserRateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // 30 búsquedas por minuto
  message: 'Demasiadas búsquedas, intenta de nuevo en 1 minuto'
});

/**
 * Rate limiter para subida de archivos
 */
const uploadRateLimit = createUserRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 uploads por 15 minutos
  message: 'Demasiadas subidas de archivos, intenta de nuevo en 15 minutos'
});

/**
 * Rate limiter para envío de mensajes/notificaciones
 */
const messageRateLimit = createUserRateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // 10 mensajes por minuto
  message: 'Demasiados mensajes enviados, intenta de nuevo en 1 minuto'
});

/**
 * Rate limiter para creación de recursos (servicios, reviews, etc.)
 */
const createResourceRateLimit = createUserRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 5, // 5 creaciones por 5 minutos
  message: 'Demasiadas creaciones de recursos, intenta de nuevo en 5 minutos'
});

/**
 * Rate limiter para APIs externas (geocoding, pagos, etc.)
 */
const externalApiRateLimit = createUserRateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20, // 20 llamadas por minuto
  message: 'Demasiadas solicitudes a servicios externos, intenta de nuevo en 1 minuto'
});

/**
 * Middleware para aplicar rate limiting dinámico basado en el rol del usuario
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const dynamicUserRateLimit = (req, res, next) => {
  let maxRequests = 100; // Default para usuarios no autenticados
  
  if (req.user) {
    switch (req.user.role) {
      case 'admin':
        maxRequests = 1000; // Admins tienen límite más alto
        break;
      case 'professional':
        maxRequests = 500; // Profesionales tienen límite medio-alto
        break;
      case 'client':
        maxRequests = 200; // Clientes tienen límite medio
        break;
      default:
        maxRequests = 100;
    }
  }

  const dynamicLimiter = createUserRateLimit({
    windowMs: 15 * 60 * 1000,
    max: maxRequests,
    message: `Límite de ${maxRequests} solicitudes por 15 minutos excedido`
  });

  return dynamicLimiter(req, res, next);
};

/**
 * Función para limpiar rate limits de un usuario específico
 * @param {string} userId - ID del usuario
 */
const clearUserRateLimit = async (userId) => {
  if (!redisClient) {
    logger.warn('Redis no disponible para limpiar rate limits');
    return;
  }

  try {
    const keys = await redisClient.keys(`rl:user:user:${userId}*`);
    if (keys.length > 0) {
      await redisClient.del(...keys);
      logger.info(`Rate limits limpiados para usuario ${userId}`);
    }
  } catch (error) {
    logger.error('Error limpiando rate limits:', {
      userId,
      error: error.message
    });
  }
};

/**
 * Función para obtener estadísticas de rate limiting
 * @param {string} identifier - Identificador (user:id o ip:address)
 * @returns {Object} Estadísticas de rate limiting
 */
const getRateLimitStats = async (identifier) => {
  if (!redisClient) {
    return { available: false, message: 'Redis no disponible' };
  }

  try {
    const key = `rl:user:${identifier}`;
    const current = await redisClient.get(key);
    const ttl = await redisClient.ttl(key);

    return {
      available: true,
      current: parseInt(current) || 0,
      remaining: Math.max(0, 100 - (parseInt(current) || 0)),
      resetTime: ttl > 0 ? new Date(Date.now() + ttl * 1000) : null
    };
  } catch (error) {
    logger.error('Error obteniendo estadísticas de rate limit:', {
      identifier,
      error: error.message
    });
    return { available: false, error: error.message };
  }
};

module.exports = {
  createUserRateLimit,
  authRateLimit,
  passwordResetRateLimit,
  emailVerificationRateLimit,
  searchRateLimit,
  uploadRateLimit,
  messageRateLimit,
  createResourceRateLimit,
  externalApiRateLimit,
  dynamicUserRateLimit,
  clearUserRateLimit,
  getRateLimitStats
};