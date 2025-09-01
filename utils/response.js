const logger = require('./logger');

/**
 * Utilidades para estandarizar las respuestas HTTP de la API
 * Proporciona métodos consistentes para enviar respuestas exitosas y de error
 */

class ApiResponse {
  constructor(res) {
    this.res = res;
  }

  /**
   * Respuesta exitosa genérica
   * @param {*} data - Datos a enviar
   * @param {string} message - Mensaje descriptivo
   * @param {number} statusCode - Código de estado HTTP
   * @param {Object} meta - Metadatos adicionales (paginación, etc.)
   */
  success(data = null, message = 'Operación exitosa', statusCode = 200, meta = null) {
    const response = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    if (meta) {
      response.meta = meta;
    }

    return this.res.status(statusCode).json(response);
  }

  /**
   * Respuesta de error genérica
   * @param {string} message - Mensaje de error
   * @param {number} statusCode - Código de estado HTTP
   * @param {*} errors - Detalles específicos del error
   * @param {string} errorCode - Código interno de error
   */
  error(message = 'Error interno del servidor', statusCode = 500, errors = null, errorCode = null) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };

    if (errors) {
      response.errors = errors;
    }

    if (errorCode) {
      response.errorCode = errorCode;
    }

    // Log del error para debugging
    if (statusCode >= 500) {
      logger.error('API Error Response', {
        message,
        statusCode,
        errors,
        errorCode,
        url: this.res.req?.originalUrl,
        method: this.res.req?.method,
        userId: this.res.req?.user?.id
      });
    }

    return this.res.status(statusCode).json(response);
  }

  /**
   * Respuesta de creación exitosa (201)
   */
  created(data, message = 'Recurso creado exitosamente') {
    return this.success(data, message, 201);
  }

  /**
   * Respuesta de actualización exitosa (200)
   */
  updated(data, message = 'Recurso actualizado exitosamente') {
    return this.success(data, message, 200);
  }

  /**
   * Respuesta de eliminación exitosa (200)
   */
  deleted(message = 'Recurso eliminado exitosamente') {
    return this.success(null, message, 200);
  }

  /**
   * Respuesta sin contenido (204)
   */
  noContent() {
    return this.res.status(204).send();
  }

  /**
   * Respuesta de solicitud incorrecta (400)
   */
  badRequest(message = 'Solicitud incorrecta', errors = null) {
    return this.error(message, 400, errors, 'BAD_REQUEST');
  }

  /**
   * Respuesta de no autorizado (401)
   */
  unauthorized(message = 'No autorizado') {
    return this.error(message, 401, null, 'UNAUTHORIZED');
  }

  /**
   * Respuesta de prohibido (403)
   */
  forbidden(message = 'Acceso prohibido') {
    return this.error(message, 403, null, 'FORBIDDEN');
  }

  /**
   * Respuesta de no encontrado (404)
   */
  notFound(message = 'Recurso no encontrado') {
    return this.error(message, 404, null, 'NOT_FOUND');
  }

  /**
   * Respuesta de conflicto (409)
   */
  conflict(message = 'Conflicto con el estado actual del recurso') {
    return this.error(message, 409, null, 'CONFLICT');
  }

  /**
   * Respuesta de datos no procesables (422)
   */
  unprocessableEntity(message = 'Datos no procesables', errors = null) {
    return this.error(message, 422, errors, 'UNPROCESSABLE_ENTITY');
  }

  /**
   * Respuesta de demasiadas solicitudes (429)
   */
  tooManyRequests(message = 'Demasiadas solicitudes') {
    return this.error(message, 429, null, 'TOO_MANY_REQUESTS');
  }

  /**
   * Respuesta de error interno del servidor (500)
   */
  internalServerError(message = 'Error interno del servidor') {
    return this.error(message, 500, null, 'INTERNAL_SERVER_ERROR');
  }

  /**
   * Respuesta de servicio no disponible (503)
   */
  serviceUnavailable(message = 'Servicio no disponible') {
    return this.error(message, 503, null, 'SERVICE_UNAVAILABLE');
  }

  /**
   * Respuesta con paginación
   */
  paginated(data, pagination, message = 'Datos obtenidos exitosamente') {
    const meta = {
      pagination: {
        currentPage: pagination.page,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        totalItems: pagination.total,
        itemsPerPage: pagination.limit,
        hasNextPage: pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrevPage: pagination.page > 1
      }
    };

    return this.success(data, message, 200, meta);
  }

  /**
   * Respuesta de validación fallida
   */
  validationError(errors, message = 'Error de validación') {
    return this.error(message, 400, errors, 'VALIDATION_ERROR');
  }

  /**
   * Respuesta de autenticación fallida
   */
  authenticationFailed(message = 'Credenciales inválidas') {
    return this.error(message, 401, null, 'AUTHENTICATION_FAILED');
  }

  /**
   * Respuesta de token expirado
   */
  tokenExpired(message = 'Token expirado') {
    return this.error(message, 401, null, 'TOKEN_EXPIRED');
  }

  /**
   * Respuesta de recurso ya existe
   */
  resourceExists(message = 'El recurso ya existe') {
    return this.error(message, 409, null, 'RESOURCE_EXISTS');
  }

  /**
   * Respuesta de operación no permitida
   */
  operationNotAllowed(message = 'Operación no permitida') {
    return this.error(message, 405, null, 'OPERATION_NOT_ALLOWED');
  }

  /**
   * Respuesta de límite excedido
   */
  limitExceeded(message = 'Límite excedido') {
    return this.error(message, 429, null, 'LIMIT_EXCEEDED');
  }

  /**
   * Respuesta de pago requerido
   */
  paymentRequired(message = 'Pago requerido') {
    return this.error(message, 402, null, 'PAYMENT_REQUIRED');
  }

  /**
   * Respuesta de mantenimiento
   */
  maintenance(message = 'Sistema en mantenimiento') {
    return this.error(message, 503, null, 'MAINTENANCE');
  }
}

/**
 * Middleware para agregar métodos de respuesta al objeto res
 */
const responseMiddleware = (req, res, next) => {
  const apiResponse = new ApiResponse(res);
  
  // Agregar métodos al objeto res
  res.apiSuccess = apiResponse.success.bind(apiResponse);
  res.apiError = apiResponse.error.bind(apiResponse);
  res.apiCreated = apiResponse.created.bind(apiResponse);
  res.apiUpdated = apiResponse.updated.bind(apiResponse);
  res.apiDeleted = apiResponse.deleted.bind(apiResponse);
  res.apiNoContent = apiResponse.noContent.bind(apiResponse);
  res.apiBadRequest = apiResponse.badRequest.bind(apiResponse);
  res.apiUnauthorized = apiResponse.unauthorized.bind(apiResponse);
  res.apiForbidden = apiResponse.forbidden.bind(apiResponse);
  res.apiNotFound = apiResponse.notFound.bind(apiResponse);
  res.apiConflict = apiResponse.conflict.bind(apiResponse);
  res.apiUnprocessableEntity = apiResponse.unprocessableEntity.bind(apiResponse);
  res.apiTooManyRequests = apiResponse.tooManyRequests.bind(apiResponse);
  res.apiInternalServerError = apiResponse.internalServerError.bind(apiResponse);
  res.apiServiceUnavailable = apiResponse.serviceUnavailable.bind(apiResponse);
  res.apiPaginated = apiResponse.paginated.bind(apiResponse);
  res.apiValidationError = apiResponse.validationError.bind(apiResponse);
  res.apiAuthenticationFailed = apiResponse.authenticationFailed.bind(apiResponse);
  res.apiTokenExpired = apiResponse.tokenExpired.bind(apiResponse);
  res.apiResourceExists = apiResponse.resourceExists.bind(apiResponse);
  res.apiOperationNotAllowed = apiResponse.operationNotAllowed.bind(apiResponse);
  res.apiLimitExceeded = apiResponse.limitExceeded.bind(apiResponse);
  res.apiPaymentRequired = apiResponse.paymentRequired.bind(apiResponse);
  res.apiMaintenance = apiResponse.maintenance.bind(apiResponse);
  
  next();
};

/**
 * Funciones de utilidad para respuestas específicas del dominio
 */
const domainResponses = {
  // Respuestas relacionadas con autenticación
  auth: {
    loginSuccess: (res, data) => {
      return res.apiSuccess(data, 'Inicio de sesión exitoso');
    },
    
    logoutSuccess: (res) => {
      return res.apiSuccess(null, 'Cierre de sesión exitoso');
    },
    
    registrationSuccess: (res, data) => {
      return res.apiCreated(data, 'Registro exitoso. Verifica tu email para activar tu cuenta.');
    },
    
    emailVerified: (res) => {
      return res.apiSuccess(null, 'Email verificado exitosamente');
    },
    
    passwordResetSent: (res) => {
      return res.apiSuccess(null, 'Instrucciones de restablecimiento enviadas a tu email');
    },
    
    passwordResetSuccess: (res) => {
      return res.apiSuccess(null, 'Contraseña restablecida exitosamente');
    },
    
    invalidCredentials: (res) => {
      return res.apiAuthenticationFailed('Email o contraseña incorrectos');
    },
    
    accountLocked: (res) => {
      return res.apiUnauthorized('Cuenta bloqueada por múltiples intentos fallidos');
    },
    
    emailNotVerified: (res) => {
      return res.apiUnauthorized('Email no verificado. Revisa tu bandeja de entrada.');
    }
  },

  // Respuestas relacionadas con servicios
  service: {
    requestCreated: (res, data) => {
      return res.apiCreated(data, 'Solicitud de servicio creada exitosamente');
    },
    
    quoteSubmitted: (res, data) => {
      return res.apiCreated(data, 'Cotización enviada exitosamente');
    },
    
    serviceCompleted: (res, data) => {
      return res.apiUpdated(data, 'Servicio marcado como completado');
    },
    
    serviceNotFound: (res) => {
      return res.apiNotFound('Solicitud de servicio no encontrada');
    },
    
    cannotModifyService: (res) => {
      return res.apiForbidden('No puedes modificar esta solicitud de servicio');
    },
    
    serviceAlreadyAccepted: (res) => {
      return res.apiConflict('Esta solicitud ya ha sido aceptada por otro profesional');
    }
  },

  // Respuestas relacionadas con pagos
  payment: {
    paymentProcessed: (res, data) => {
      return res.apiSuccess(data, 'Pago procesado exitosamente');
    },
    
    paymentFailed: (res, error) => {
      return res.apiBadRequest('Error al procesar el pago', { paymentError: error });
    },
    
    insufficientFunds: (res) => {
      return res.apiPaymentRequired('Fondos insuficientes');
    },
    
    refundProcessed: (res, data) => {
      return res.apiSuccess(data, 'Reembolso procesado exitosamente');
    }
  },

  // Respuestas relacionadas con reseñas
  review: {
    reviewSubmitted: (res, data) => {
      return res.apiCreated(data, 'Reseña enviada exitosamente');
    },
    
    cannotReviewOwnService: (res) => {
      return res.apiForbidden('No puedes reseñar tu propio servicio');
    },
    
    alreadyReviewed: (res) => {
      return res.apiConflict('Ya has reseñado este servicio');
    },
    
    cannotReviewIncompleteService: (res) => {
      return res.apiBadRequest('Solo puedes reseñar servicios completados');
    }
  },

  // Respuestas relacionadas con profesionales
  professional: {
    profileCompleted: (res, data) => {
      return res.apiUpdated(data, 'Perfil profesional completado exitosamente');
    },
    
    verificationSubmitted: (res) => {
      return res.apiSuccess(null, 'Documentos de verificación enviados. Revisaremos tu información.');
    },
    
    notVerified: (res) => {
      return res.apiForbidden('Tu cuenta profesional aún no está verificada');
    },
    
    outsideServiceArea: (res) => {
      return res.apiBadRequest('Esta solicitud está fuera de tu área de servicio');
    }
  },

  // Respuestas relacionadas con ubicación
  location: {
    locationUpdated: (res, data) => {
      return res.apiSuccess(data, 'Ubicación actualizada exitosamente');
    },
    
    invalidLocation: (res) => {
      return res.apiBadRequest('Coordenadas de ubicación inválidas');
    },
    
    locationRequired: (res) => {
      return res.apiBadRequest('Se requiere ubicación para esta operación');
    }
  }
};

/**
 * Manejador de errores global
 */
const errorHandler = (err, req, res, next) => {
  // Log del error
  logger.logError(err, req);

  // Errores de validación de Mongoose
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
      value: e.value
    }));
    return res.apiValidationError(errors, 'Error de validación de datos');
  }

  // Errores de duplicado de Mongoose
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.apiConflict(`El ${field} ya está en uso`);
  }

  // Errores de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.apiUnauthorized('Token inválido');
  }

  if (err.name === 'TokenExpiredError') {
    return res.apiTokenExpired();
  }

  // Errores de cast de MongoDB
  if (err.name === 'CastError') {
    return res.apiBadRequest('ID inválido');
  }

  // Error por defecto
  return res.apiInternalServerError();
};

module.exports = {
  ApiResponse,
  responseMiddleware,
  domainResponses,
  errorHandler
};