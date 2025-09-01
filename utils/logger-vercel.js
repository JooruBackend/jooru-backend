const winston = require('winston');

// Logger simplificado para Vercel - solo console
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

// Solo usar console transport
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: consoleFormat,
  defaultMeta: {
    service: 'jooru-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.Console({
      level: 'info',
      format: consoleFormat
    })
  ],
  // Exception y rejection handlers usando console
  exceptionHandlers: [
    new winston.transports.Console({
      format: consoleFormat
    })
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: consoleFormat
    })
  ]
});

// Métodos de logging personalizados
logger.logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id || 'anonymous'
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
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id || 'anonymous'
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
  
  logger.info('Authentication Event', authData);
};

// Stream para morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Crear logger de módulo
logger.createModuleLogger = (moduleName) => {
  return logger.child({ module: moduleName });
};

module.exports = logger;