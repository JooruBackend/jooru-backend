/**
 * Configuración de proveedores de pago para Colombia
 * Incluye configuraciones específicas para Wompi, MercadoPago y otros proveedores
 */

const PAYMENT_PROVIDERS_CONFIG = {
  // Wompi - Proveedor colombiano
  wompi: {
    name: 'Wompi',
    country: 'CO',
    currency: 'COP',
    fees: {
      creditCard: 0.029, // 2.9% + $900 COP
      debitCard: 0.019,  // 1.9% + $900 COP
      pse: 0.015,        // 1.5% + $900 COP
      nequi: 0.015,      // 1.5% + $900 COP
      daviplata: 0.015   // 1.5% + $900 COP
    },
    fixedFee: 900, // COP
    minAmount: 1000,   // COP
    maxAmount: 50000000, // COP
    supportedMethods: ['credit_card', 'debit_card', 'pse', 'nequi', 'daviplata'],
    webhookEvents: [
      'transaction.updated',
      'transaction.created'
    ],
    testMode: {
      baseUrl: 'https://sandbox.wompi.co/v1',
      publicKey: process.env.WOMPI_TEST_PUBLIC_KEY,
      privateKey: process.env.WOMPI_TEST_PRIVATE_KEY
    },
    production: {
      baseUrl: 'https://production.wompi.co/v1',
      publicKey: process.env.WOMPI_PUBLIC_KEY,
      privateKey: process.env.WOMPI_PRIVATE_KEY
    }
  },

  // MercadoPago - Para Colombia
  mercadopago: {
    name: 'MercadoPago',
    country: 'CO',
    currency: 'COP',
    fees: {
      creditCard: 0.0349, // 3.49% + $300 COP
      debitCard: 0.0249,  // 2.49% + $300 COP
      pse: 0.0199,        // 1.99% + $300 COP
      efecty: 0.0299      // 2.99% + $300 COP
    },
    fixedFee: 300, // COP
    minAmount: 1000,   // COP
    maxAmount: 30000000, // COP
    supportedMethods: ['credit_card', 'debit_card', 'pse', 'efecty'],
    webhookEvents: [
      'payment',
      'merchant_order'
    ],
    testMode: {
      baseUrl: 'https://api.mercadopago.com',
      accessToken: process.env.MERCADOPAGO_TEST_ACCESS_TOKEN
    },
    production: {
      baseUrl: 'https://api.mercadopago.com',
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
    }
  },

  // Stripe - Internacional
  stripe: {
    name: 'Stripe',
    country: 'GLOBAL',
    currency: 'COP',
    fees: {
      creditCard: 0.0349, // 3.49% + $900 COP
      debitCard: 0.0349   // 3.49% + $900 COP
    },
    fixedFee: 900, // COP
    minAmount: 1000,   // COP
    maxAmount: 99999999, // COP
    supportedMethods: ['credit_card', 'debit_card'],
    webhookEvents: [
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'charge.dispute.created'
    ],
    testMode: {
      publicKey: process.env.STRIPE_TEST_PUBLISHABLE_KEY,
      secretKey: process.env.STRIPE_TEST_SECRET_KEY
    },
    production: {
      publicKey: process.env.STRIPE_PUBLISHABLE_KEY,
      secretKey: process.env.STRIPE_SECRET_KEY
    }
  },

  // PayPal - Internacional
  paypal: {
    name: 'PayPal',
    country: 'GLOBAL',
    currency: 'COP',
    fees: {
      paypal: 0.0449 // 4.49% + $900 COP
    },
    fixedFee: 900, // COP
    minAmount: 1000,   // COP
    maxAmount: 60000000, // COP
    supportedMethods: ['paypal'],
    webhookEvents: [
      'PAYMENT.CAPTURE.COMPLETED',
      'PAYMENT.CAPTURE.DENIED'
    ],
    testMode: {
      clientId: process.env.PAYPAL_TEST_CLIENT_ID,
      clientSecret: process.env.PAYPAL_TEST_CLIENT_SECRET,
      baseUrl: 'https://api.sandbox.paypal.com'
    },
    production: {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      baseUrl: 'https://api.paypal.com'
    }
  }
};

/**
 * Configuración de prioridades de proveedores por método de pago
 */
const PROVIDER_PRIORITY = {
  credit_card: ['wompi', 'mercadopago', 'stripe'],
  debit_card: ['wompi', 'mercadopago', 'stripe'],
  pse: ['wompi', 'mercadopago'],
  nequi: ['wompi'],
  daviplata: ['wompi'],
  efecty: ['mercadopago'],
  paypal: ['paypal']
};

/**
 * Obtener el mejor proveedor para un método de pago
 * @param {string} paymentMethod - Método de pago
 * @param {number} amount - Monto en COP
 * @returns {Object} Configuración del proveedor
 */
function getBestProvider(paymentMethod, amount = 0) {
  const providers = PROVIDER_PRIORITY[paymentMethod] || [];
  
  for (const providerKey of providers) {
    const provider = PAYMENT_PROVIDERS_CONFIG[providerKey];
    if (provider && amount >= provider.minAmount && amount <= provider.maxAmount) {
      return {
        key: providerKey,
        config: provider
      };
    }
  }
  
  // Fallback a Stripe si no hay otros disponibles
  return {
    key: 'stripe',
    config: PAYMENT_PROVIDERS_CONFIG.stripe
  };
}

/**
 * Calcular tarifas de procesamiento
 * @param {string} providerKey - Clave del proveedor
 * @param {string} paymentMethod - Método de pago
 * @param {number} amount - Monto en COP
 * @returns {Object} Desglose de tarifas
 */
function calculateProcessingFees(providerKey, paymentMethod, amount) {
  const provider = PAYMENT_PROVIDERS_CONFIG[providerKey];
  if (!provider) {
    throw new Error(`Proveedor ${providerKey} no encontrado`);
  }
  
  const feeRate = provider.fees[paymentMethod] || provider.fees.creditCard || 0;
  const variableFee = Math.round(amount * feeRate);
  const fixedFee = provider.fixedFee || 0;
  const totalFee = variableFee + fixedFee;
  
  return {
    amount,
    feeRate,
    variableFee,
    fixedFee,
    totalFee,
    netAmount: amount - totalFee,
    provider: provider.name
  };
}

/**
 * Obtener configuración de webhook para un proveedor
 * @param {string} providerKey - Clave del proveedor
 * @returns {Object} Configuración de webhook
 */
function getWebhookConfig(providerKey) {
  const provider = PAYMENT_PROVIDERS_CONFIG[providerKey];
  if (!provider) {
    return null;
  }
  
  return {
    events: provider.webhookEvents,
    secret: process.env[`${providerKey.toUpperCase()}_WEBHOOK_SECRET`]
  };
}

/**
 * Validar si un proveedor está configurado
 * @param {string} providerKey - Clave del proveedor
 * @returns {boolean} True si está configurado
 */
function isProviderConfigured(providerKey) {
  const provider = PAYMENT_PROVIDERS_CONFIG[providerKey];
  if (!provider) return false;
  
  const isProduction = process.env.NODE_ENV === 'production';
  const config = isProduction ? provider.production : provider.testMode;
  
  switch (providerKey) {
    case 'wompi':
      return !!(config.publicKey && config.privateKey);
    case 'mercadopago':
      return !!config.accessToken;
    case 'stripe':
      return !!(config.publicKey && config.secretKey);
    case 'paypal':
      return !!(config.clientId && config.clientSecret);
    default:
      return false;
  }
}

module.exports = {
  PAYMENT_PROVIDERS_CONFIG,
  PROVIDER_PRIORITY,
  getBestProvider,
  calculateProcessingFees,
  getWebhookConfig,
  isProviderConfigured
};