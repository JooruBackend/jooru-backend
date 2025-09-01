const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Por favor ingresa un email válido']
  },
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
    select: false // No incluir en consultas por defecto
  },
  profile: {
    firstName: {
      type: String,
      required: [true, 'El nombre es requerido'],
      trim: true,
      maxlength: [50, 'El nombre no puede exceder 50 caracteres']
    },
    lastName: {
      type: String,
      required: [true, 'El apellido es requerido'],
      trim: true,
      maxlength: [50, 'El apellido no puede exceder 50 caracteres']
    },
    phone: {
      type: String,
      required: [true, 'El teléfono es requerido'],
      match: [/^[+]?[1-9]\d{1,14}$/, 'Por favor ingresa un número de teléfono válido']
    },
    avatar: {
      type: String,
      default: null
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function(value) {
          return value < new Date();
        },
        message: 'La fecha de nacimiento debe ser anterior a hoy'
      }
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
      default: 'prefer_not_to_say'
    },
    address: {
      street: {
        type: String,
        trim: true
      },
      city: {
        type: String,
        trim: true
      },
      state: {
        type: String,
        trim: true
      },
      zipCode: {
        type: String,
        trim: true
      },
      country: {
        type: String,
        trim: true,
        default: 'Colombia'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: '2dsphere'
      }
    }
  },
  role: {
    type: String,
    enum: ['client', 'professional', 'admin'],
    default: 'client'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  verificationToken: {
    type: String,
    select: false
  },
  verificationTokenExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  refreshTokens: [{
    token: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 2592000 // 30 días
    }
  }],
  preferences: {
    language: {
      type: String,
      enum: ['es', 'en'],
      default: 'es'
    },
    currency: {
      type: String,
      enum: ['COP', 'USD'],
    default: 'COP'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      }
    },
    privacy: {
      showPhone: {
        type: Boolean,
        default: false
      },
      showEmail: {
        type: Boolean,
        default: false
      }
    }
  },
  deviceTokens: [{
    token: String,
    platform: {
      type: String,
      enum: ['ios', 'android', 'web']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  socialAccounts: {
    google: {
      id: String,
      email: String
    },
    facebook: {
      id: String,
      email: String
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
userSchema.index({ email: 1 });
userSchema.index({ 'profile.address.coordinates': '2dsphere' });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ createdAt: -1 });

// Virtual para nombre completo
userSchema.virtual('profile.fullName').get(function() {
  return `${this.profile.firstName} ${this.profile.lastName}`;
});

// Virtual para verificar si la cuenta está bloqueada
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Middleware pre-save para hashear contraseña
userSchema.pre('save', async function(next) {
  // Solo hashear la contraseña si ha sido modificada
  if (!this.isModified('password')) return next();
  
  try {
    // Hashear contraseña con costo de 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para generar JWT
userSchema.methods.generateAuthToken = function() {
  const payload = {
    userId: this._id,
    email: this.email,
    role: this.role
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
    issuer: 'proserv-api',
    audience: 'proserv-app'
  });
};

// Método para generar refresh token
userSchema.methods.generateRefreshToken = function() {
  const payload = {
    id: this._id,
    type: 'refresh'
  };
  
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
    issuer: 'proserv-api',
    audience: 'proserv-app'
  });
};

// Método para incrementar intentos de login fallidos
userSchema.methods.incLoginAttempts = function() {
  // Si tenemos un bloqueo previo y ha expirado, reiniciar
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Si llegamos al máximo de intentos y no estamos bloqueados, bloquear cuenta
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000 // 2 horas
    };
  }
  
  return this.updateOne(updates);
};

// Método para resetear intentos de login
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Método para agregar device token
userSchema.methods.addDeviceToken = function(token, platform) {
  // Remover token existente si ya existe
  this.deviceTokens = this.deviceTokens.filter(dt => dt.token !== token);
  
  // Agregar nuevo token
  this.deviceTokens.push({ token, platform });
  
  // Mantener solo los últimos 5 tokens
  if (this.deviceTokens.length > 5) {
    this.deviceTokens = this.deviceTokens.slice(-5);
  }
  
  return this.save();
};

// Método para remover device token
userSchema.methods.removeDeviceToken = function(token) {
  this.deviceTokens = this.deviceTokens.filter(dt => dt.token !== token);
  return this.save();
};

// Método para obtener datos públicos del usuario
userSchema.methods.getPublicProfile = function() {
  return {
    _id: this._id,
    profile: {
      firstName: this.profile.firstName,
      lastName: this.profile.lastName,
      avatar: this.profile.avatar,
      fullName: this.profile.fullName
    },
    role: this.role,
    isVerified: this.isVerified,
    createdAt: this.createdAt
  };
};

// Método estático para buscar por email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

// Método estático para buscar usuarios cerca de una ubicación
userSchema.statics.findNearby = function(coordinates, maxDistance = 25000) {
  return this.find({
    'profile.address.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: maxDistance
      }
    },
    isActive: true
  });
};

module.exports = mongoose.model('User', userSchema);