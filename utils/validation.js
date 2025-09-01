const Joi = require('joi');
const mongoose = require('mongoose');

// Validaciones personalizadas
const customValidations = {
  // Validar ObjectId de MongoDB
  objectId: Joi.string().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }, 'ObjectId validation'),

  // Validar coordenadas geográficas
  coordinates: Joi.array().items(
    Joi.number().min(-180).max(180), // longitud
    Joi.number().min(-90).max(90)    // latitud
  ).length(2),

  // Validar número de teléfono (formato internacional)
  phone: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).messages({
    'string.pattern.base': 'El teléfono debe estar en formato internacional (+1234567890)'
  }),

  // Validar contraseña fuerte
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).*$/)
    .messages({
      'string.pattern.base': 'La contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial'
    }),

  // Validar URL de imagen
  imageUrl: Joi.string().uri().pattern(/\.(jpg|jpeg|png|gif|webp)$/i).messages({
    'string.pattern.base': 'La URL debe ser una imagen válida (jpg, jpeg, png, gif, webp)'
  }),

  // Validar fecha futura
  futureDate: Joi.date().greater('now').messages({
    'date.greater': 'La fecha debe ser futura'
  }),

  // Validar horario (HH:MM)
  timeFormat: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).messages({
    'string.pattern.base': 'El horario debe estar en formato HH:MM (24 horas)'
  }),

  // Validar código postal
  postalCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).messages({
    'string.pattern.base': 'Código postal inválido'
  }),

  // Validar rating (1-5)
  rating: Joi.number().min(1).max(5).precision(1),

  // Validar precio (positivo con hasta 2 decimales)
  price: Joi.number().positive().precision(2),

  // Validar precio en pesos colombianos
  priceColombianPesos: Joi.number().positive().integer().min(1000).max(50000000).messages({
    'number.min': 'El precio mínimo es $1,000 COP',
    'number.max': 'El precio máximo es $50,000,000 COP',
    'number.integer': 'Los precios en pesos colombianos deben ser números enteros'
  }),

  // Validar duración en minutos
  duration: Joi.number().integer().min(15).max(480), // 15 min a 8 horas

  // Validar categoría de servicio
  serviceCategory: Joi.string().valid(
    'limpieza', 'reparaciones', 'jardineria', 'plomeria', 'electricidad',
    'pintura', 'carpinteria', 'tecnologia', 'tutoria', 'cuidado_personal',
    'eventos', 'transporte', 'consultoria', 'diseno', 'fotografia',
    'cocina', 'mascotas', 'salud', 'fitness', 'otros'
  ),

  // Validar urgencia
  urgency: Joi.string().valid('baja', 'media', 'alta', 'urgente'),

  // Validar estado de solicitud
  requestStatus: Joi.string().valid(
    'pendiente', 'cotizada', 'aceptada', 'en_progreso', 
    'completada', 'cancelada', 'disputada'
  ),

  // Validar método de pago
  paymentMethod: Joi.string().valid(
    'tarjeta_credito', 'tarjeta_debito', 'paypal', 
    'transferencia', 'efectivo', 'wallet', 'pse', 
    'nequi', 'daviplata', 'efecty', 'mercadopago'
  ),

  // Validar tipo de usuario
  userRole: Joi.string().valid('client', 'professional', 'admin'),

  // Validar idioma
  language: Joi.string().valid('es', 'en', 'pt', 'fr'),

  // Validar moneda
  currency: Joi.string().valid('COP', 'USD', 'EUR', 'MXN', 'ARS', 'CLP', 'PEN'),

  // Validar zona horaria
  timezone: Joi.string().pattern(/^[A-Za-z_]+\/[A-Za-z_]+$/)
};

// Esquemas de validación para diferentes entidades
const schemas = {
  // Registro de usuario
  userRegistration: Joi.object({
    email: Joi.string().email().required(),
    password: customValidations.password.required(),
    profile: Joi.object({
      firstName: Joi.string().min(2).max(50).required(),
      lastName: Joi.string().min(2).max(50).required(),
      phone: customValidations.phone.required()
    }).required(),
    role: customValidations.userRole.required(),
    acceptTerms: Joi.boolean().valid(true).required(),
    acceptPrivacy: Joi.boolean().optional(),
    businessInfo: Joi.object({
      businessName: Joi.string().min(2).max(100).optional(),
      profession: Joi.string().max(100).optional(),
      experience: Joi.string().max(50).optional(),
      description: Joi.string().max(1000).optional()
    }).optional(),
    language: customValidations.language.default('es'),
    timezone: customValidations.timezone.optional()
  }),

  // Login de usuario
  userLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    rememberMe: Joi.boolean().default(false),
    deviceToken: Joi.string().optional()
  }),

  // Actualización de perfil
  profileUpdate: Joi.object({
    firstName: Joi.string().min(2).max(50),
    lastName: Joi.string().min(2).max(50),
    phone: customValidations.phone,
    avatar: customValidations.imageUrl,
    bio: Joi.string().max(500),
    language: customValidations.language,
    timezone: customValidations.timezone,
    notifications: Joi.object({
      email: Joi.boolean(),
      push: Joi.boolean(),
      sms: Joi.boolean()
    })
  }),

  // Dirección
  address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    country: Joi.string().required(),
    postalCode: customValidations.postalCode.required(),
    coordinates: customValidations.coordinates.required(),
    instructions: Joi.string().max(200)
  }),

  // Perfil profesional
  professionalProfile: Joi.object({
    businessName: Joi.string().max(100),
    description: Joi.string().max(1000).required(),
    services: Joi.array().items(
      Joi.object({
        category: customValidations.serviceCategory.required(),
        subcategory: Joi.string().required(),
        title: Joi.string().max(100).required(),
        description: Joi.string().max(500).required(),
        basePrice: customValidations.price.required(),
        currency: customValidations.currency.required(),
        duration: customValidations.duration.required(),
        images: Joi.array().items(customValidations.imageUrl).max(5)
      })
    ).min(1).required(),
    availability: Joi.object({
      monday: Joi.object({
        enabled: Joi.boolean().required(),
        start: customValidations.timeFormat,
        end: customValidations.timeFormat
      }),
      tuesday: Joi.object({
        enabled: Joi.boolean().required(),
        start: customValidations.timeFormat,
        end: customValidations.timeFormat
      }),
      wednesday: Joi.object({
        enabled: Joi.boolean().required(),
        start: customValidations.timeFormat,
        end: customValidations.timeFormat
      }),
      thursday: Joi.object({
        enabled: Joi.boolean().required(),
        start: customValidations.timeFormat,
        end: customValidations.timeFormat
      }),
      friday: Joi.object({
        enabled: Joi.boolean().required(),
        start: customValidations.timeFormat,
        end: customValidations.timeFormat
      }),
      saturday: Joi.object({
        enabled: Joi.boolean().required(),
        start: customValidations.timeFormat,
        end: customValidations.timeFormat
      }),
      sunday: Joi.object({
        enabled: Joi.boolean().required(),
        start: customValidations.timeFormat,
        end: customValidations.timeFormat
      })
    }).required(),
    serviceRadius: Joi.number().min(1).max(100).required(), // km
    credentials: Joi.array().items(
      Joi.object({
        type: Joi.string().required(),
        title: Joi.string().required(),
        issuer: Joi.string().required(),
        date: Joi.date().required(),
        expiryDate: Joi.date().greater(Joi.ref('date')),
        document: customValidations.imageUrl
      })
    ),
    bankAccount: Joi.object({
      accountNumber: Joi.string().required(),
      routingNumber: Joi.string().required(),
      accountType: Joi.string().valid('checking', 'savings').required(),
      bankName: Joi.string().required()
    })
  }),

  // Solicitud de servicio
  serviceRequest: Joi.object({
    category: customValidations.serviceCategory.required(),
    subcategory: Joi.string().required(),
    title: Joi.string().max(100).required(),
    description: Joi.string().max(1000).required(),
    urgency: customValidations.urgency.required(),
    images: Joi.array().items(customValidations.imageUrl).max(5),
    location: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      country: Joi.string().required(),
      postalCode: customValidations.postalCode.required(),
      coordinates: customValidations.coordinates.required(),
      instructions: Joi.string().max(200)
    }).required(),
    preferredDate: customValidations.futureDate.required(),
    preferredTime: customValidations.timeFormat.required(),
    flexible: Joi.boolean().default(false),
    estimatedBudget: Joi.object({
      min: customValidations.price.required(),
      max: customValidations.price.required(),
      currency: customValidations.currency.required()
    }),
    requirements: Joi.array().items(Joi.string().max(100)).max(10),
    paymentMethod: customValidations.paymentMethod.required()
  }),

  // Cotización
  quote: Joi.object({
    serviceRequestId: customValidations.objectId.required(),
    price: customValidations.price.required(),
    currency: customValidations.currency.required(),
    estimatedDuration: customValidations.duration.required(),
    description: Joi.string().max(500).required(),
    materials: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        quantity: Joi.number().positive().required(),
        unitPrice: customValidations.price.required(),
        total: customValidations.price.required()
      })
    ),
    validUntil: customValidations.futureDate.required(),
    terms: Joi.string().max(1000)
  }),

  // Reseña
  review: Joi.object({
    serviceRequestId: customValidations.objectId.required(),
    rating: customValidations.rating.required(),
    aspectRatings: Joi.object({
      quality: customValidations.rating,
      punctuality: customValidations.rating,
      communication: customValidations.rating,
      cleanliness: customValidations.rating,
      value: customValidations.rating
    }),
    comment: Joi.string().max(1000),
    tags: Joi.array().items(Joi.string().max(30)).max(5),
    images: Joi.array().items(customValidations.imageUrl).max(3),
    isPublic: Joi.boolean().default(true)
  }),

  // Paginación
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // Filtros de búsqueda
  searchFilters: Joi.object({
    category: customValidations.serviceCategory,
    minPrice: customValidations.price,
    maxPrice: customValidations.price,
    minRating: customValidations.rating,
    location: Joi.object({
      coordinates: customValidations.coordinates.required(),
      radius: Joi.number().min(1).max(50).default(10) // km
    }),
    availability: Joi.object({
      date: Joi.date().min('now'),
      time: customValidations.timeFormat
    }),
    verified: Joi.boolean(),
    instantBooking: Joi.boolean()
  }),

  // Cambio de contraseña
  passwordChange: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: customValidations.password.required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
      'any.only': 'Las contraseñas no coinciden'
    })
  }),

  // Reset de contraseña
  passwordReset: Joi.object({
    email: Joi.string().email().required()
  }),

  // Confirmación de reset de contraseña
  passwordResetConfirm: Joi.object({
    token: Joi.string().required(),
    newPassword: customValidations.password.required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
  }),

  // Verificación de email
  emailVerification: Joi.object({
    token: Joi.string().required()
  }),

  // Configuración de notificaciones
  notificationSettings: Joi.object({
    email: Joi.object({
      newRequests: Joi.boolean().default(true),
      quotes: Joi.boolean().default(true),
      messages: Joi.boolean().default(true),
      reviews: Joi.boolean().default(true),
      promotions: Joi.boolean().default(false)
    }),
    push: Joi.object({
      newRequests: Joi.boolean().default(true),
      quotes: Joi.boolean().default(true),
      messages: Joi.boolean().default(true),
      reviews: Joi.boolean().default(true),
      promotions: Joi.boolean().default(false)
    }),
    sms: Joi.object({
      urgent: Joi.boolean().default(true),
      reminders: Joi.boolean().default(true)
    })
  })
};

// Middleware de validación
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors
      });
    }

    // Reemplazar los datos originales con los validados y sanitizados
    req[property] = value;
    next();
  };
};

// Función para validar datos sin middleware
const validateData = (data, schema) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context.value
    }));
    
    return { isValid: false, errors, data: null };
  }

  return { isValid: true, errors: null, data: value };
};

// Validaciones específicas para casos complejos
const customValidators = {
  // Validar que el horario de fin sea después del de inicio
  validateTimeRange: (start, end) => {
    const startTime = new Date(`2000-01-01T${start}:00`);
    const endTime = new Date(`2000-01-01T${end}:00`);
    return endTime > startTime;
  },

  // Validar que la fecha de expiración sea futura
  validateExpiryDate: (date) => {
    return new Date(date) > new Date();
  },

  // Validar que el presupuesto máximo sea mayor al mínimo
  validateBudgetRange: (min, max) => {
    return max >= min;
  },

  // Validar coordenadas dentro de un país específico
  validateCountryCoordinates: (coordinates, country) => {
    // Rangos aproximados por país (se puede expandir)
    const countryBounds = {
      'Mexico': {
        lat: { min: 14.5, max: 32.7 },
        lng: { min: -118.4, max: -86.7 }
      },
      'Colombia': {
        lat: { min: -4.2, max: 12.5 },
        lng: { min: -81.7, max: -66.9 }
      },
      'Argentina': {
        lat: { min: -55.1, max: -21.8 },
        lng: { min: -73.6, max: -53.6 }
      }
      // Agregar más países según necesidad
    };

    const bounds = countryBounds[country];
    if (!bounds) return true; // Si no hay límites definidos, aceptar

    const [lng, lat] = coordinates;
    return lat >= bounds.lat.min && lat <= bounds.lat.max &&
           lng >= bounds.lng.min && lng <= bounds.lng.max;
  },

  // Validar disponibilidad de horario
  validateAvailability: (availability) => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    for (const day of days) {
      const daySchedule = availability[day];
      if (daySchedule.enabled) {
        if (!daySchedule.start || !daySchedule.end) {
          return { isValid: false, message: `Horario incompleto para ${day}` };
        }
        
        if (!customValidators.validateTimeRange(daySchedule.start, daySchedule.end)) {
          return { isValid: false, message: `Horario inválido para ${day}: la hora de fin debe ser posterior a la de inicio` };
        }
      }
    }
    
    return { isValid: true };
  }
};

module.exports = {
  schemas,
  validate,
  validateData,
  customValidations,
  customValidators
};