/**
 * Middleware para estandarizar las respuestas de la API
 * Proporciona métodos consistentes para enviar respuestas exitosas y de error
 */

const logger = require('../utils/logger');

/**
 * Middleware que añade métodos de respuesta estandarizados al objeto response
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const responseMiddleware = (req, res, next) => {
  /**
   * Envía una respuesta exitosa estandarizada
   * @param {*} data - Datos a enviar
   * @param {string} message - Mensaje descriptivo
   * @param {number} statusCode - Código de estado HTTP (default: 200)
   */
  res.success = (data = null, message = 'Operación exitosa', statusCode = 200) => {
    const response = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    // Log de respuesta exitosa
    logger.info('HTTP Response', {
      success: true,
      statusCode,
      dataSize: data ? JSON.stringify(data).length : 0,
      method: req.method,
      url: req.originalUrl,
      userId: req.user ? req.user.id : null
    });

    return res.status(statusCode).json(response);
  };

  /**
   * Envía una respuesta de error estandarizada
   * @param {string} message - Mensaje de error
   * @param {number} statusCode - Código de estado HTTP (default: 400)
   * @param {*} errors - Detalles adicionales del error
   */
  res.error = (message = 'Error en la operación', statusCode = 400, errors = null) => {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };

    // Incluir detalles del error solo en desarrollo
    if (errors && process.env.NODE_ENV === 'development') {
      response.errors = errors;
    }

    // Log de respuesta de error
    logger.logRequest(req, res, {
      success: false,
      statusCode,
      error: message,
      errors
    });

    return res.status(statusCode).json(response);
  };

  /**
   * Envía una respuesta paginada estandarizada
   * @param {Array} data - Array de datos
   * @param {Object} pagination - Información de paginación
   * @param {string} message - Mensaje descriptivo
   */
  res.paginated = (data, pagination, message = 'Datos obtenidos exitosamente') => {
    const response = {
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || 0,
        pages: Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
        hasNext: pagination.hasNext || false,
        hasPrev: pagination.hasPrev || false
      },
      timestamp: new Date().toISOString()
    };

    // Log de respuesta paginada
    logger.info('HTTP Response', {
      success: true,
      statusCode: 200,
      dataCount: data.length,
      pagination: response.pagination
    });

    return res.status(200).json(response);
  };

  /**
   * Envía una respuesta de validación de error
   * @param {Array|Object} validationErrors - Errores de validación
   * @param {string} message - Mensaje principal
   */
  res.validationError = (validationErrors, message = 'Errores de validación') => {
    const response = {
      success: false,
      message,
      errors: validationErrors,
      timestamp: new Date().toISOString()
    };

    // Log de errores de validación
    logger.logRequest(req, res, {
      success: false,
      statusCode: 422,
      validationErrors
    });

    return res.status(422).json(response);
  };

  /**
   * Envía una respuesta de solicitud incorrecta
   * @param {string} message - Mensaje de error
   * @param {*} errors - Detalles adicionales del error
   */
  res.badRequest = (message = 'Solicitud incorrecta', errors = null) => {
    return res.error(message, 400, errors);
  };

  /**
   * Envía una respuesta de no autorizado
   * @param {string} message - Mensaje de error
   */
  res.unauthorized = (message = 'No autorizado') => {
    return res.error(message, 401);
  };

  /**
   * Envía una respuesta de prohibido
   * @param {string} message - Mensaje de error
   */
  res.forbidden = (message = 'Acceso prohibido') => {
    return res.error(message, 403);
  };

  /**
   * Envía una respuesta de no encontrado
   * @param {string} message - Mensaje de error
   */
  res.notFound = (message = 'Recurso no encontrado') => {
    return res.error(message, 404);
  };

  /**
   * Envía una respuesta de conflicto
   * @param {string} message - Mensaje de error
   */
  res.conflict = (message = 'Conflicto en la operación') => {
    return res.error(message, 409);
  };

  /**
   * Envía una respuesta de error interno del servidor
   * @param {string} message - Mensaje de error
   * @param {*} error - Objeto de error para logging
   */
  res.serverError = (message = 'Error interno del servidor', error = null) => {
    // Log del error interno
    if (error) {
      logger.error('Error interno del servidor:', {
        error: error.message,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    return res.error(message, 500);
  };

  next();
};

module.exports = responseMiddleware;