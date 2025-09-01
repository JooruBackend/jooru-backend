const mongoose = require('mongoose');

const professionalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  businessInfo: {
    businessName: {
      type: String,
      trim: true,
      maxlength: [100, 'El nombre del negocio no puede exceder 100 caracteres']
    },
    businessType: {
      type: String,
      enum: ['individual', 'company', 'freelancer'],
      default: 'individual'
    },
    taxId: {
      type: String,
      trim: true
    },
    website: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, 'Por favor ingresa una URL válida']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'La descripción no puede exceder 1000 caracteres']
    }
  },
  services: [{
    category: {
      type: String,
      required: true,
      enum: [
        'home_services',
        'technical_services', 
        'professional_services',
        'beauty_wellness',
        'automotive',
        'education',
        'health',
        'cleaning',
        'other'
      ]
    },
    subcategory: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'El título del servicio no puede exceder 100 caracteres']
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'La descripción del servicio no puede exceder 500 caracteres']
    },
    pricing: {
      type: {
        type: String,
        enum: ['fixed', 'hourly', 'quote'],
        required: true
      },
      amount: {
        type: Number,
        min: [0, 'El precio no puede ser negativo']
      },
      currency: {
        type: String,
        enum: ['COP', 'USD'],
        default: 'COP'
      },
      unit: {
        type: String,
        enum: ['hour', 'service', 'day', 'project'],
        default: 'service'
      }
    },
    duration: {
      estimated: {
        type: Number, // en minutos
        min: [15, 'La duración mínima es 15 minutos']
      },
      unit: {
        type: String,
        enum: ['minutes', 'hours', 'days'],
        default: 'hours'
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    images: [{
      url: String,
      description: String,
      isPrimary: {
        type: Boolean,
        default: false
      }
    }],
    requirements: [{
      type: String,
      trim: true
    }],
    tags: [{
      type: String,
      trim: true,
      lowercase: true
    }]
  }],
  availability: {
    schedule: {
      monday: {
        available: { type: Boolean, default: true },
        start: { type: String, default: '09:00' },
        end: { type: String, default: '18:00' },
        breaks: [{
          start: String,
          end: String
        }]
      },
      tuesday: {
        available: { type: Boolean, default: true },
        start: { type: String, default: '09:00' },
        end: { type: String, default: '18:00' },
        breaks: [{
          start: String,
          end: String
        }]
      },
      wednesday: {
        available: { type: Boolean, default: true },
        start: { type: String, default: '09:00' },
        end: { type: String, default: '18:00' },
        breaks: [{
          start: String,
          end: String
        }]
      },
      thursday: {
        available: { type: Boolean, default: true },
        start: { type: String, default: '09:00' },
        end: { type: String, default: '18:00' },
        breaks: [{
          start: String,
          end: String
        }]
      },
      friday: {
        available: { type: Boolean, default: true },
        start: { type: String, default: '09:00' },
        end: { type: String, default: '18:00' },
        breaks: [{
          start: String,
          end: String
        }]
      },
      saturday: {
        available: { type: Boolean, default: false },
        start: { type: String, default: '10:00' },
        end: { type: String, default: '16:00' },
        breaks: []
      },
      sunday: {
        available: { type: Boolean, default: false },
        start: { type: String, default: '10:00' },
        end: { type: String, default: '16:00' },
        breaks: []
      }
    },
    exceptions: [{
      date: {
        type: Date,
        required: true
      },
      available: {
        type: Boolean,
        default: false
      },
      reason: {
        type: String,
        trim: true
      },
      customSchedule: {
        start: String,
        end: String
      }
    }],
    timeZone: {
      type: String,
      default: 'America/Bogota'
    }
  },
  credentials: [{
    type: {
      type: String,
      enum: ['certificate', 'license', 'degree', 'insurance', 'other'],
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    issuer: {
      type: String,
      required: true,
      trim: true
    },
    issueDate: {
      type: Date,
      required: true
    },
    expiryDate: {
      type: Date
    },
    credentialNumber: {
      type: String,
      trim: true
    },
    document: {
      url: String,
      filename: String
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date
  }],
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    },
    breakdown: {
      punctuality: { type: Number, default: 0 },
      quality: { type: Number, default: 0 },
      communication: { type: Number, default: 0 },
      value: { type: Number, default: 0 }
    }
  },
  statistics: {
    totalServices: {
      type: Number,
      default: 0
    },
    completedServices: {
      type: Number,
      default: 0
    },
    cancelledServices: {
      type: Number,
      default: 0
    },
    totalEarnings: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number, // en minutos
      default: 0
    },
    completionRate: {
      type: Number, // porcentaje
      default: 0
    }
  },
  verification: {
    status: {
      type: String,
      enum: ['pending', 'in_review', 'verified', 'rejected'],
      default: 'pending'
    },
    submittedAt: {
      type: Date,
      default: Date.now
    },
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: {
      type: String,
      trim: true
    },
    requiredDocuments: [{
      type: String,
      enum: ['id', 'address_proof', 'professional_license', 'insurance', 'tax_registration'],
      required: true
    }],
    submittedDocuments: [{
      type: String,
      url: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  serviceRadius: {
    type: Number,
    default: 25, // kilómetros
    min: [1, 'El radio de servicio mínimo es 1 km'],
    max: [100, 'El radio de servicio máximo es 100 km']
  },
  preferences: {
    autoAcceptBookings: {
      type: Boolean,
      default: false
    },
    minimumNotice: {
      type: Number, // horas
      default: 2
    },
    maximumBookingsPerDay: {
      type: Number,
      default: 8
    },
    emergencyServices: {
      type: Boolean,
      default: false
    },
    weekendWork: {
      type: Boolean,
      default: false
    }
  },
  bankAccount: {
    accountHolder: String,
    bankName: String,
    accountNumber: String,
    routingNumber: String,
    accountType: {
      type: String,
      enum: ['checking', 'savings']
    },
    isVerified: {
      type: Boolean,
      default: false
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['basic', 'premium', 'enterprise'],
      default: 'basic'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: Date,
    isActive: {
      type: Boolean,
      default: true
    },
    features: [{
      name: String,
      enabled: Boolean
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
professionalSchema.index({ userId: 1 });
professionalSchema.index({ 'services.category': 1, 'services.subcategory': 1 });
professionalSchema.index({ 'rating.average': -1 });
professionalSchema.index({ 'verification.status': 1 });
professionalSchema.index({ isActive: 1, 'verification.status': 1 });
professionalSchema.index({ serviceRadius: 1 });
professionalSchema.index({ createdAt: -1 });

// Virtual para obtener el usuario completo
professionalSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual para calcular la tasa de finalización
professionalSchema.virtual('completionRate').get(function() {
  if (this.statistics.totalServices === 0) return 0;
  return (this.statistics.completedServices / this.statistics.totalServices) * 100;
});

// Virtual para verificar si está disponible ahora
professionalSchema.virtual('isAvailableNow').get(function() {
  const now = new Date();
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const currentTime = now.toTimeString().slice(0, 5);
  
  const daySchedule = this.availability.schedule[dayOfWeek];
  
  if (!daySchedule.available) return false;
  
  return currentTime >= daySchedule.start && currentTime <= daySchedule.end;
});

// Método para actualizar estadísticas
professionalSchema.methods.updateStatistics = function(serviceData) {
  this.statistics.totalServices += 1;
  
  if (serviceData.status === 'completed') {
    this.statistics.completedServices += 1;
    this.statistics.totalEarnings += serviceData.finalCost || 0;
  } else if (serviceData.status === 'cancelled') {
    this.statistics.cancelledServices += 1;
  }
  
  // Calcular tasa de finalización
  this.statistics.completionRate = (this.statistics.completedServices / this.statistics.totalServices) * 100;
  
  return this.save();
};

// Método para actualizar rating
professionalSchema.methods.updateRating = function(newRating) {
  const currentTotal = this.rating.average * this.rating.count;
  this.rating.count += 1;
  this.rating.average = (currentTotal + newRating.overall) / this.rating.count;
  
  // Actualizar breakdown
  if (newRating.breakdown) {
    const breakdown = this.rating.breakdown;
    const count = this.rating.count;
    
    Object.keys(newRating.breakdown).forEach(aspect => {
      const currentTotal = breakdown[aspect] * (count - 1);
      breakdown[aspect] = (currentTotal + newRating.breakdown[aspect]) / count;
    });
  }
  
  return this.save();
};

// Método para verificar disponibilidad en una fecha específica
professionalSchema.methods.isAvailableAt = function(date) {
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
  const daySchedule = this.availability.schedule[dayOfWeek];
  
  if (!daySchedule.available) return false;
  
  // Verificar excepciones
  const exception = this.availability.exceptions.find(exc => 
    exc.date.toDateString() === date.toDateString()
  );
  
  if (exception) {
    return exception.available;
  }
  
  return true;
};

// Método para obtener servicios activos
professionalSchema.methods.getActiveServices = function() {
  return this.services.filter(service => service.isActive);
};

// Método para agregar servicio
professionalSchema.methods.addService = function(serviceData) {
  this.services.push(serviceData);
  return this.save();
};

// Método para actualizar servicio
professionalSchema.methods.updateService = function(serviceId, updateData) {
  const service = this.services.id(serviceId);
  if (!service) {
    throw new Error('Servicio no encontrado');
  }
  
  Object.assign(service, updateData);
  return this.save();
};

// Método para eliminar servicio
professionalSchema.methods.removeService = function(serviceId) {
  this.services.id(serviceId).remove();
  return this.save();
};

// Método estático para buscar profesionales por servicio
professionalSchema.statics.findByService = function(category, subcategory, coordinates, radius = 25000) {
  const query = {
    'services.category': category,
    'services.isActive': true,
    'verification.status': 'verified',
    isActive: true
  };
  
  if (subcategory) {
    query['services.subcategory'] = subcategory;
  }
  
  let aggregationPipeline = [
    { $match: query },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $match: {
        'user.isActive': true
      }
    }
  ];
  
  // Agregar filtro de geolocalización si se proporcionan coordenadas
  if (coordinates && coordinates.length === 2) {
    aggregationPipeline.push({
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: coordinates
        },
        distanceField: 'distance',
        maxDistance: radius,
        spherical: true,
        query: {
          'user.profile.address.coordinates': { $exists: true }
        }
      }
    });
  }
  
  // Ordenar por rating y distancia
  aggregationPipeline.push({
    $sort: {
      'rating.average': -1,
      distance: 1
    }
  });
  
  return this.aggregate(aggregationPipeline);
};

// Método estático para obtener profesionales top
professionalSchema.statics.getTopRated = function(limit = 10) {
  return this.find({
    'verification.status': 'verified',
    isActive: true,
    'rating.count': { $gte: 5 }
  })
  .populate('userId', 'profile email')
  .sort({ 'rating.average': -1, 'rating.count': -1 })
  .limit(limit);
};

module.exports = mongoose.model('Professional', professionalSchema);