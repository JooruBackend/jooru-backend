/**
 * Modelo de Factura
 * Gestiona la información de facturas generadas en la plataforma
 */

const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  // Número de factura único
  invoiceNumber: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  
  // Referencia al pago
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true,
    index: true
  },
  
  // Referencia a la solicitud de servicio
  serviceRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceRequest',
    required: true,
    index: true
  },
  
  // Cliente (quien paga)
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Profesional (quien recibe el pago)
  professional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professional',
    required: true,
    index: true
  },
  
  // Estado de la factura
  status: {
    type: String,
    enum: ['draft', 'issued', 'paid', 'cancelled', 'refunded'],
    default: 'draft',
    index: true
  },
  
  // Información del cliente en la factura
  clientInfo: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: 'Colombia'
      }
    },
    // Información fiscal del cliente
    taxId: String, // NIT o Cédula
    taxIdType: {
      type: String,
      enum: ['NIT', 'CC', 'CE', 'PP'],
      default: 'CC'
    }
  },
  
  // Información del profesional en la factura
  professionalInfo: {
    businessName: {
      type: String,
      required: true
    },
    contactName: String,
    email: {
      type: String,
      required: true
    },
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: 'Colombia'
      }
    },
    // Información fiscal del profesional
    taxId: {
      type: String,
      required: true
    },
    taxIdType: {
      type: String,
      enum: ['NIT', 'CC'],
      default: 'NIT'
    },
    regime: {
      type: String,
      enum: ['simplified', 'common'],
      default: 'simplified'
    }
  },
  
  // Detalles del servicio facturado
  serviceDetails: {
    title: {
      type: String,
      required: true
    },
    description: String,
    category: String,
    subcategory: String,
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Cálculos financieros
  amounts: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    taxableAmount: {
      type: Number,
      required: true,
      min: 0
    },
    taxes: {
      iva: {
        rate: {
          type: Number,
          default: 19 // 19% IVA en Colombia
        },
        amount: {
          type: Number,
          default: 0
        }
      },
      retention: {
        rate: {
          type: Number,
          default: 0
        },
        amount: {
          type: Number,
          default: 0
        }
      }
    },
    platformFee: {
      rate: {
        type: Number,
        required: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      }
    },
    total: {
      type: Number,
      required: true,
      min: 0
    }
  },
  
  // Moneda
  currency: {
    type: String,
    default: 'COP',
    enum: ['COP', 'USD', 'EUR']
  },
  
  // Fechas importantes
  issueDate: {
    type: Date,
    default: Date.now
  },
  
  dueDate: {
    type: Date,
    required: true
  },
  
  paidDate: {
    type: Date
  },
  
  // Información de pago
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'digital_wallet', 'cash']
  },
  
  paymentReference: String,
  
  // Notas y observaciones
  notes: String,
  
  internalNotes: String, // Solo para uso interno
  
  // Información de facturación electrónica (DIAN)
  electronicInvoice: {
    cufe: String, // Código Único de Facturación Electrónica
    qrCode: String,
    xmlPath: String,
    pdfPath: String,
    dianResponse: mongoose.Schema.Types.Mixed,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    }
  },
  
  // Información de anulación/cancelación
  cancellation: {
    reason: String,
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Información de reembolso
  refund: {
    amount: {
      type: Number,
      min: 0
    },
    reason: String,
    refundedAt: Date,
    refundReference: String
  },
  
  // Metadatos
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Información de auditoría
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compuestos
invoiceSchema.index({ client: 1, status: 1 });
invoiceSchema.index({ professional: 1, status: 1 });
invoiceSchema.index({ status: 1, issueDate: -1 });
invoiceSchema.index({ issueDate: 1, dueDate: 1 });
invoiceSchema.index({ 'electronicInvoice.cufe': 1 });

// Virtuals
invoiceSchema.virtual('isOverdue').get(function() {
  return this.status !== 'paid' && this.dueDate < new Date();
});

invoiceSchema.virtual('daysPastDue').get(function() {
  if (this.status === 'paid' || this.dueDate >= new Date()) {
    return 0;
  }
  const diffTime = new Date() - this.dueDate;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

invoiceSchema.virtual('netAmount').get(function() {
  return this.amounts.total - this.amounts.platformFee.amount;
});

invoiceSchema.virtual('formattedInvoiceNumber').get(function() {
  return `INV-${this.invoiceNumber}`;
});

// Métodos de instancia
invoiceSchema.methods.markAsPaid = function(paymentDate, paymentMethod, paymentReference) {
  this.status = 'paid';
  this.paidDate = paymentDate || new Date();
  this.paymentMethod = paymentMethod;
  this.paymentReference = paymentReference;
  return this.save();
};

invoiceSchema.methods.cancel = function(reason, cancelledBy) {
  this.status = 'cancelled';
  this.cancellation = {
    reason,
    cancelledAt: new Date(),
    cancelledBy
  };
  return this.save();
};

invoiceSchema.methods.processRefund = function(amount, reason, refundReference) {
  this.status = 'refunded';
  this.refund = {
    amount: amount || this.amounts.total,
    reason,
    refundedAt: new Date(),
    refundReference
  };
  return this.save();
};

invoiceSchema.methods.calculateAmounts = function() {
  const { quantity, unitPrice, discount } = this.serviceDetails;
  const subtotal = quantity * unitPrice;
  const discountAmount = discount || 0;
  const taxableAmount = subtotal - discountAmount;
  
  // Calcular IVA
  const ivaAmount = taxableAmount * (this.amounts.taxes.iva.rate / 100);
  
  // Calcular retención
  const retentionAmount = taxableAmount * (this.amounts.taxes.retention.rate / 100);
  
  // Calcular comisión de plataforma
  const platformFeeAmount = taxableAmount * (this.amounts.platformFee.rate / 100);
  
  // Total
  const total = taxableAmount + ivaAmount - retentionAmount;
  
  this.amounts = {
    ...this.amounts,
    subtotal,
    discount: discountAmount,
    taxableAmount,
    taxes: {
      iva: {
        ...this.amounts.taxes.iva,
        amount: ivaAmount
      },
      retention: {
        ...this.amounts.taxes.retention,
        amount: retentionAmount
      }
    },
    platformFee: {
      ...this.amounts.platformFee,
      amount: platformFeeAmount
    },
    total
  };
  
  return this;
};

// Métodos estáticos
invoiceSchema.statics.generateInvoiceNumber = async function() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // Buscar el último número de factura del mes
  const prefix = `${year}${month}`;
  const lastInvoice = await this.findOne({
    invoiceNumber: new RegExp(`^${prefix}`)
  }).sort({ invoiceNumber: -1 });
  
  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.substr(-4));
    sequence = lastSequence + 1;
  }
  
  return `${prefix}${String(sequence).padStart(4, '0')}`;
};

invoiceSchema.statics.getInvoiceStats = async function(filters = {}) {
  const matchQuery = { ...filters };
  
  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        paidInvoices: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
        },
        pendingInvoices: {
          $sum: { $cond: [{ $eq: ['$status', 'issued'] }, 1, 0] }
        },
        overdueInvoices: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'issued'] },
                  { $lt: ['$dueDate', new Date()] }
                ]
              },
              1,
              0
            ]
          }
        },
        totalAmount: { $sum: '$amounts.total' },
        paidAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amounts.total', 0] }
        },
        pendingAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'issued'] }, '$amounts.total', 0] }
        },
        avgInvoiceAmount: { $avg: '$amounts.total' }
      }
    }
  ]);
  
  return stats[0] || {
    totalInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    overdueInvoices: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    avgInvoiceAmount: 0
  };
};

// Middleware pre-save
invoiceSchema.pre('save', async function(next) {
  // Generar número de factura si no existe
  if (!this.invoiceNumber) {
    this.invoiceNumber = await this.constructor.generateInvoiceNumber();
  }
  
  // Calcular montos si es necesario
  if (this.isModified('serviceDetails') || this.isModified('amounts.taxes') || this.isModified('amounts.platformFee')) {
    this.calculateAmounts();
  }
  
  // Establecer fecha de vencimiento si no existe (30 días por defecto)
  if (!this.dueDate) {
    this.dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  
  next();
});

// Middleware post-save para notificaciones
invoiceSchema.post('save', async function(doc, next) {
  try {
    const NotificationService = require('../utils/notifications');
    
    // Notificar cuando se emite la factura
    if (doc.isModified('status') && doc.status === 'issued') {
      await NotificationService.sendInvoiceIssued(doc.client, doc);
      await NotificationService.sendInvoiceIssued(doc.professional, doc);
    }
    
    // Notificar cuando se paga la factura
    if (doc.isModified('status') && doc.status === 'paid') {
      await NotificationService.sendInvoicePaid(doc.client, doc);
      await NotificationService.sendInvoicePaid(doc.professional, doc);
    }
    
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error('Error enviando notificaciones de factura:', {
      error: error.message,
      invoiceId: doc._id,
      invoiceNumber: doc.invoiceNumber
    });
  }
  
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);