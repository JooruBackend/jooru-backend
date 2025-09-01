/**
 * Modelo de Método de Pago
 * Gestiona los métodos de pago guardados de los usuarios
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const paymentMethodSchema = new mongoose.Schema({
  // Usuario propietario
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Tipo de método de pago
  type: {
    type: String,
    enum: ['card', 'bank_transfer', 'digital_wallet'],
    required: true
  },
  
  // Información de tarjeta (encriptada)
  card: {
    // Token del proveedor de pago
    token: String,
    
    // Últimos 4 dígitos (no encriptados)
    last4: String,
    
    // Marca de la tarjeta
    brand: {
      type: String,
      enum: ['visa', 'mastercard', 'amex', 'diners', 'discover', 'jcb']
    },
    
    // Mes de expiración
    expMonth: Number,
    
    // Año de expiración
    expYear: Number,
    
    // Nombre del titular
    holderName: String,
    
    // Tipo de tarjeta
    cardType: {
      type: String,
      enum: ['credit', 'debit']
    },
    
    // País emisor
    country: String,
    
    // Banco emisor
    issuer: String
  },
  
  // Información de cuenta bancaria (encriptada)
  bankAccount: {
    // Banco
    bankName: String,
    
    // Tipo de cuenta
    accountType: {
      type: String,
      enum: ['savings', 'checking']
    },
    
    // Últimos 4 dígitos de la cuenta
    accountLast4: String,
    
    // Nombre del titular
    holderName: String,
    
    // Documento del titular
    holderDocument: String,
    
    // Tipo de documento
    holderDocumentType: {
      type: String,
      enum: ['CC', 'CE', 'NIT', 'PP']
    }
  },
  
  // Información de billetera digital
  digitalWallet: {
    // Proveedor
    provider: {
      type: String,
      enum: ['nequi', 'daviplata', 'paypal', 'apple_pay', 'google_pay']
    },
    
    // Identificador de la cuenta (encriptado)
    accountId: String,
    
    // Teléfono asociado (para billeteras móviles)
    phone: String,
    
    // Email asociado
    email: String
  },
  
  // Configuración
  isDefault: {
    type: Boolean,
    default: false
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Información del proveedor de pago
  provider: {
    name: {
      type: String,
      enum: ['stripe', 'mercadopago', 'wompi', 'payu'],
      required: true
    },
    
    // ID del método en el proveedor
    providerId: String,
    
    // ID del cliente en el proveedor
    customerId: String,
    
    // Respuesta del proveedor
    providerResponse: mongoose.Schema.Types.Mixed
  },
  
  // Verificación
  isVerified: {
    type: Boolean,
    default: false
  },
  
  verifiedAt: {
    type: Date
  },
  
  // Estadísticas de uso
  usage: {
    totalTransactions: {
      type: Number,
      default: 0
    },
    
    totalAmount: {
      type: Number,
      default: 0
    },
    
    lastUsedAt: {
      type: Date
    },
    
    failedAttempts: {
      type: Number,
      default: 0
    },
    
    lastFailureAt: {
      type: Date
    }
  },
  
  // Metadatos
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Información de auditoría
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
paymentMethodSchema.index({ user: 1, isActive: 1 });
paymentMethodSchema.index({ user: 1, isDefault: 1 });
paymentMethodSchema.index({ user: 1, type: 1 });
paymentMethodSchema.index({ 'provider.name': 1, 'provider.providerId': 1 });

// Virtuals
paymentMethodSchema.virtual('isExpired').get(function() {
  if (this.type === 'card' && this.card.expMonth && this.card.expYear) {
    const now = new Date();
    const expDate = new Date(this.card.expYear, this.card.expMonth - 1);
    return expDate < now;
  }
  return false;
});

paymentMethodSchema.virtual('displayName').get(function() {
  switch (this.type) {
    case 'card':
      return `${this.card.brand?.toUpperCase()} ****${this.card.last4}`;
    case 'bank_transfer':
      return `${this.bankAccount.bankName} ****${this.bankAccount.accountLast4}`;
    case 'digital_wallet':
      return `${this.digitalWallet.provider?.toUpperCase()}`;
    default:
      return 'Método de pago';
  }
});

paymentMethodSchema.virtual('isUsable').get(function() {
  return this.isActive && this.isVerified && !this.isExpired;
});

// Métodos de instancia
paymentMethodSchema.methods.getPublicDetails = function() {
  const publicData = {
    id: this._id,
    type: this.type,
    isDefault: this.isDefault,
    isActive: this.isActive,
    isVerified: this.isVerified,
    isExpired: this.isExpired,
    displayName: this.displayName,
    provider: this.provider.name,
    createdAt: this.createdAt,
    lastUsedAt: this.usage.lastUsedAt
  };

  // Agregar detalles específicos según el tipo
  switch (this.type) {
    case 'card':
      publicData.card = {
        last4: this.card.last4,
        brand: this.card.brand,
        expMonth: this.card.expMonth,
        expYear: this.card.expYear,
        cardType: this.card.cardType,
        country: this.card.country
      };
      break;
    case 'bank_transfer':
      publicData.bankAccount = {
        bankName: this.bankAccount.bankName,
        accountType: this.bankAccount.accountType,
        accountLast4: this.bankAccount.accountLast4
      };
      break;
    case 'digital_wallet':
      publicData.digitalWallet = {
        provider: this.digitalWallet.provider,
        phone: this.digitalWallet.phone ? 
          this.digitalWallet.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1***$3') : undefined
      };
      break;
  }

  return publicData;
};

paymentMethodSchema.methods.markAsUsed = function(amount) {
  this.usage.totalTransactions += 1;
  this.usage.totalAmount += amount;
  this.usage.lastUsedAt = new Date();
  return this.save();
};

paymentMethodSchema.methods.markAsFailed = function() {
  this.usage.failedAttempts += 1;
  this.usage.lastFailureAt = new Date();
  
  // Desactivar si hay muchos fallos
  if (this.usage.failedAttempts >= 5) {
    this.isActive = false;
  }
  
  return this.save();
};

paymentMethodSchema.methods.verify = function() {
  this.isVerified = true;
  this.verifiedAt = new Date();
  return this.save();
};

paymentMethodSchema.methods.deactivate = function() {
  this.isActive = false;
  this.isDefault = false;
  return this.save();
};

// Métodos estáticos
paymentMethodSchema.statics.findUserMethods = function(userId, options = {}) {
  const query = { user: userId };
  
  if (options.activeOnly !== false) {
    query.isActive = true;
  }
  
  if (options.type) {
    query.type = options.type;
  }
  
  if (options.verified !== false) {
    query.isVerified = true;
  }
  
  return this.find(query).sort({ isDefault: -1, createdAt: -1 });
};

paymentMethodSchema.statics.findDefaultMethod = function(userId) {
  return this.findOne({
    user: userId,
    isDefault: true,
    isActive: true,
    isVerified: true
  });
};

paymentMethodSchema.statics.setAsDefault = async function(userId, methodId) {
  // Remover default de otros métodos
  await this.updateMany(
    { user: userId },
    { isDefault: false }
  );
  
  // Establecer como default
  return this.findByIdAndUpdate(
    methodId,
    { isDefault: true },
    { new: true }
  );
};

// Middleware pre-save
paymentMethodSchema.pre('save', async function(next) {
  // Si es el primer método de pago del usuario, hacerlo predeterminado
  if (this.isNew) {
    const existingMethods = await this.constructor.countDocuments({
      user: this.user,
      isActive: true
    });
    
    if (existingMethods === 0) {
      this.isDefault = true;
    }
  }
  
  // Si se marca como predeterminado, desmarcar otros
  if (this.isModified('isDefault') && this.isDefault) {
    await this.constructor.updateMany(
      { 
        user: this.user,
        _id: { $ne: this._id }
      },
      { isDefault: false }
    );
  }
  
  next();
});

// Middleware para encriptar datos sensibles
paymentMethodSchema.pre('save', function(next) {
  // Encriptar información sensible antes de guardar
  // Nota: En producción, usar una librería de encriptación robusta
  
  if (this.isModified('bankAccount.holderDocument') && this.bankAccount.holderDocument) {
    // Encriptar documento (ejemplo básico)
    this.bankAccount.holderDocument = crypto
      .createHash('sha256')
      .update(this.bankAccount.holderDocument)
      .digest('hex');
  }
  
  next();
});

// Middleware post-save para logging
paymentMethodSchema.post('save', function(doc, next) {
  const logger = require('../utils/logger');
  
  if (doc.isNew) {
    logger.info('Payment method created:', {
      userId: doc.user,
      type: doc.type,
      provider: doc.provider.name,
      isDefault: doc.isDefault
    });
  }
  
  next();
});

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);