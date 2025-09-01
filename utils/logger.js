const winston = require('winston');
const path = require('path');

// Configurar formato personalizado
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Configurar formato para consola
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

// Crear directorio de logs si no existe
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configurar transports
const transports = [
  // Archivo para todos los logs
  new winston.transports.File({
    filename: path.join(logsDir, 'app.log'),
    level: 'info',
    format: customFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true
  }),
  
  // Archivo separado para errores
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: customFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    tailable: true
  })
];

// Agregar consola en desarrollo
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      level: 'debug',
      format: consoleFormat
    })
  );
}

// Crear logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: {
    service: 'proserv-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports,
  // Manejar excepciones no capturadas
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: customFormat
    })
  ],
  // Manejar rechazos de promesas no capturadas
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: customFormat
    })
  ]
});

// Métodos de utilidad para logging estructurado
logger.logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: req.user ? req.user.id : null
  };
  
  if (res.statusCode >= 400) {
    logger.warn('HTTP Request', logData);
  } else {
    logger.info('HTTP Request', logData);
  }
};

logger.logError = (error, req = null, additionalInfo = {}) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...additionalInfo
  };
  
  if (req) {
    errorData.request = {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
      userId: req.user ? req.user.id : null,
      ip: req.ip || req.connection.remoteAddress
    };
  }
  
  logger.error('Application Error', errorData);
};

logger.logAuth = (action, userId, success, additionalInfo = {}) => {
  const authData = {
    action,
    userId,
    success,
    timestamp: new Date().toISOString(),
    ...additionalInfo
  };
  
  if (success) {
    logger.info('Auth Success', authData);
  } else {
    logger.warn('Auth Failure', authData);
  }
};

logger.logPayment = (action, amount, currency, userId, success, additionalInfo = {}) => {
  const paymentData = {
    action,
    amount,
    currency,
    userId,
    success,
    timestamp: new Date().toISOString(),
    ...additionalInfo
  };
  
  if (success) {
    logger.info('Payment Success', paymentData);
  } else {
    logger.error('Payment Failure', paymentData);
  }
};

logger.logService = (action, serviceRequestId, clientId, professionalId, additionalInfo = {}) => {
  const serviceData = {
    action,
    serviceRequestId,
    clientId,
    professionalId,
    timestamp: new Date().toISOString(),
    ...additionalInfo
  };
  
  logger.info('Service Action', serviceData);
};

logger.logSecurity = (event, severity, userId = null, additionalInfo = {}) => {
  const securityData = {
    event,
    severity,
    userId,
    timestamp: new Date().toISOString(),
    ...additionalInfo
  };
  
  if (severity === 'high' || severity === 'critical') {
    logger.error('Security Event', securityData);
  } else {
    logger.warn('Security Event', securityData);
  }
};

logger.logPerformance = (operation, duration, additionalInfo = {}) => {
  const performanceData = {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...additionalInfo
  };
  
  if (duration > 5000) { // Más de 5 segundos
    logger.warn('Slow Operation', performanceData);
  } else {
    logger.debug('Performance', performanceData);
  }
};

// Middleware para logging de requests HTTP
logger.requestMiddleware = () => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Capturar cuando la respuesta termina
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      logger.logRequest(req, res, responseTime);
    });
    
    next();
  };
};

// Stream para Morgan (HTTP request logger)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Función para crear logger específico de módulo
logger.createModuleLogger = (moduleName) => {
  return logger.child({ module: moduleName });
};

// Configuración específica para producción
if (process.env.NODE_ENV === 'production') {
  // En producción, también enviar logs críticos por email o servicio externo
  // Aquí podrías agregar transports adicionales como:
  // - Winston-mail para enviar errores críticos por email
  // - Winston-slack para notificaciones en Slack
  // - Sentry transport para monitoreo de errores
  
  // Ejemplo de configuración para Sentry (comentado)
  /*
  if (process.env.SENTRY_DSN) {
    const Sentry = require('@sentry/node');
    
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV
    });
    
    // Override error logging para enviar a Sentry
    const originalError = logger.error;
    logger.error = function(message, meta) {
      originalError.call(this, message, meta);
      
      if (typeof message === 'object' && message.stack) {
        Sentry.captureException(message);
      } else {
        Sentry.captureMessage(message, 'error');
      }
    };
  }
  */
}

module.exports = logger;