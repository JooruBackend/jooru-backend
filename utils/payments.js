const stripe = require('stripe');
const paypal = require('@paypal/checkout-server-sdk');
const logger = require('./logger');
const { 
  PAYMENT_PROVIDERS_CONFIG, 
  getBestProvider, 
  calculateProcessingFees,
  isProviderConfigured 
} = require('../config/payment-providers');

/**
 * Configuración de proveedores de pago
 */
const PAYMENT_PROVIDERS = {
  STRIPE: 'stripe',
  PAYPAL: 'paypal',
  MERCADOPAGO: 'mercadopago',
  WOMPI: 'wompi'
};

/**
 * Configuración de comisiones de la plataforma (actualizadas para Colombia)
 */
const PLATFORM_FEE_CONFIG = {
  default: 0.05, // 5% por defecto
  professional: {
    basic: 0.05,    // 5% para profesionales básicos
    premium: 0.03,  // 3% para profesionales premium
    enterprise: 0.02 // 2% para profesionales enterprise
  },
  service: {
    cleaning: 0.04,
    plumbing: 0.05,
    electrical: 0.05,
    gardening: 0.04,
    painting: 0.04,
    carpentry: 0.05,
    appliance_repair: 0.06,
    beauty: 0.04,
    tutoring: 0.03,
    delivery: 0.06
  },
  // Configuración específica para Colombia
  colombia: {
    iva: parseFloat(process.env.COLOMBIA_IVA_RATE) || 0.19,
    retention: parseFloat(process.env.COLOMBIA_RETENTION_RATE) || 0.04,
    minTransaction: 1000, // COP
    maxTransaction: 50000000 // COP
  }
};

/**
 * Configuración de impuestos
 */
const TAX_CONFIG = {
  colombia: {
    iva: 0.19, // 19% IVA
    retention: 0.04 // 4% retención en la fuente
  }
};

/**
 * Servicio de pagos unificado
 */
class PaymentService {
  constructor() {
    this.stripeClient = null;
    this.paypalClient = null;
    this.providers = new Map();
    
    this.initializeProviders();
  }

  /**
   * Inicializar proveedores de pago
   */
  initializeProviders() {
    try {
      // Inicializar Stripe
      if (process.env.STRIPE_SECRET_KEY) {
        this.stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
        this.providers.set(PAYMENT_PROVIDERS.STRIPE, this.stripeClient);
        logger.info('Stripe inicializado correctamente');
      }

      // Inicializar PayPal
      if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
        const environment = process.env.NODE_ENV === 'production'
          ? new paypal.core.LiveEnvironment(
              process.env.PAYPAL_CLIENT_ID,
              process.env.PAYPAL_CLIENT_SECRET
            )
          : new paypal.core.SandboxEnvironment(
              process.env.PAYPAL_CLIENT_ID,
              process.env.PAYPAL_CLIENT_SECRET
            );
        
        this.paypalClient = new paypal.core.PayPalHttpClient(environment);
        this.providers.set(PAYMENT_PROVIDERS.PAYPAL, this.paypalClient);
        logger.info('PayPal inicializado correctamente');
      }

      // Inicializar MercadoPago
      if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
        const mercadopago = require('mercadopago');
        mercadopago.configure({
          access_token: process.env.MERCADOPAGO_ACCESS_TOKEN
        });
        this.providers.set(PAYMENT_PROVIDERS.MERCADOPAGO, mercadopago);
        logger.info('MercadoPago inicializado correctamente');
      }

      // Inicializar Wompi
      if (process.env.WOMPI_PUBLIC_KEY && process.env.WOMPI_PRIVATE_KEY) {
        const wompi = {
          publicKey: process.env.WOMPI_PUBLIC_KEY,
          privateKey: process.env.WOMPI_PRIVATE_KEY,
          baseUrl: process.env.WOMPI_BASE_URL || 'https://production.wompi.co/v1'
        };
        this.providers.set(PAYMENT_PROVIDERS.WOMPI, wompi);
        logger.info('Wompi inicializado correctamente');
      }
      
    } catch (error) {
      logger.error('Error inicializando proveedores de pago', {
        error: error.message
      });
    }
  }

  /**
   * Crear intención de pago con Stripe
   * @param {Object} paymentData - Datos del pago
   * @returns {Object} Intención de pago
   */
  async createStripePaymentIntent(paymentData) {
    try {
      if (!this.stripeClient) {
        throw new Error('Stripe no está configurado');
      }

      const {
        amount,
        currency = 'cop',
        customerId,
        serviceRequestId,
        professionalId,
        clientId,
        description,
        metadata = {},
        paymentMethodId,
        confirmationMethod = 'manual',
        captureMethod = 'manual' // Para autorizar primero, capturar después
      } = paymentData;

      // Convertir a centavos
      const amountInCents = Math.round(amount * 100);

      const intentData = {
        amount: amountInCents,
        currency: currency.toLowerCase(),
        description: description || 'Pago por servicio profesional',
        metadata: {
          serviceRequestId: serviceRequestId?.toString(),
          professionalId: professionalId?.toString(),
          clientId: clientId?.toString(),
          ...metadata
        },
        confirmation_method: confirmationMethod,
        capture_method: captureMethod
      };

      // Agregar customer si existe
      if (customerId) {
        intentData.customer = customerId;
      }

      // Agregar método de pago si existe
      if (paymentMethodId) {
        intentData.payment_method = paymentMethodId;
      }

      const paymentIntent = await this.stripeClient.paymentIntents.create(intentData);

      logger.info('Payment Intent creado', {
        paymentIntentId: paymentIntent.id,
        amount: amount,
        currency,
        serviceRequestId
      });

      return {
        success: true,
        paymentIntent: {
          id: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          status: paymentIntent.status,
          amount: amount,
          currency,
          captureMethod,
          confirmationMethod
        }
      };
      
    } catch (error) {
      logger.error('Error creando Payment Intent', {
        error: error.message,
        amount: paymentData.amount,
        serviceRequestId: paymentData.serviceRequestId
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Confirmar pago con Stripe
   * @param {string} paymentIntentId - ID de la intención de pago
   * @param {string} paymentMethodId - ID del método de pago (opcional)
   * @returns {Object} Resultado de la confirmación
   */
  async confirmStripePayment(paymentIntentId, paymentMethodId = null) {
    try {
      if (!this.stripeClient) {
        throw new Error('Stripe no está configurado');
      }

      const confirmData = {};
      if (paymentMethodId) {
        confirmData.payment_method = paymentMethodId;
      }

      const paymentIntent = await this.stripeClient.paymentIntents.confirm(
        paymentIntentId,
        confirmData
      );

      logger.info('Pago confirmado', {
        paymentIntentId,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100
      });

      return {
        success: true,
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          charges: paymentIntent.charges?.data || []
        }
      };
      
    } catch (error) {
      logger.error('Error confirmando pago', {
        paymentIntentId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Capturar pago autorizado
   * @param {string} paymentIntentId - ID de la intención de pago
   * @param {number} amountToCapture - Cantidad a capturar (opcional)
   * @returns {Object} Resultado de la captura
   */
  async captureStripePayment(paymentIntentId, amountToCapture = null) {
    try {
      if (!this.stripeClient) {
        throw new Error('Stripe no está configurado');
      }

      const captureData = {};
      if (amountToCapture) {
        captureData.amount_to_capture = Math.round(amountToCapture * 100);
      }

      const paymentIntent = await this.stripeClient.paymentIntents.capture(
        paymentIntentId,
        captureData
      );

      logger.info('Pago capturado', {
        paymentIntentId,
        status: paymentIntent.status,
        amountCaptured: paymentIntent.amount_received / 100
      });

      return {
        success: true,
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amountCaptured: paymentIntent.amount_received / 100,
          currency: paymentIntent.currency
        }
      };
      
    } catch (error) {
      logger.error('Error capturando pago', {
        paymentIntentId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cancelar pago
   * @param {string} paymentIntentId - ID de la intención de pago
   * @param {string} reason - Razón de cancelación
   * @returns {Object} Resultado de la cancelación
   */
  async cancelStripePayment(paymentIntentId, reason = 'requested_by_customer') {
    try {
      if (!this.stripeClient) {
        throw new Error('Stripe no está configurado');
      }

      const paymentIntent = await this.stripeClient.paymentIntents.cancel(
        paymentIntentId,
        { cancellation_reason: reason }
      );

      logger.info('Pago cancelado', {
        paymentIntentId,
        status: paymentIntent.status,
        reason
      });

      return {
        success: true,
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          cancellationReason: reason
        }
      };
      
    } catch (error) {
      logger.error('Error cancelando pago', {
        paymentIntentId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Crear reembolso
   * @param {string} paymentIntentId - ID de la intención de pago
   * @param {number} amount - Cantidad a reembolsar (opcional, por defecto total)
   * @param {string} reason - Razón del reembolso
   * @returns {Object} Resultado del reembolso
   */
  async createStripeRefund(paymentIntentId, amount = null, reason = 'requested_by_customer') {
    try {
      if (!this.stripeClient) {
        throw new Error('Stripe no está configurado');
      }

      const refundData = {
        payment_intent: paymentIntentId,
        reason
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }

      const refund = await this.stripeClient.refunds.create(refundData);

      logger.info('Reembolso creado', {
        refundId: refund.id,
        paymentIntentId,
        amount: refund.amount / 100,
        status: refund.status
      });

      return {
        success: true,
        refund: {
          id: refund.id,
          amount: refund.amount / 100,
          currency: refund.currency,
          status: refund.status,
          reason
        }
      };
      
    } catch (error) {
      logger.error('Error creando reembolso', {
        paymentIntentId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Crear orden de PayPal
   * @param {Object} orderData - Datos de la orden
   * @returns {Object} Orden de PayPal
   */
  async createPayPalOrder(orderData) {
    try {
      if (!this.paypalClient) {
        throw new Error('PayPal no está configurado');
      }

      const {
        amount,
        currency = 'COP',
        serviceRequestId,
        professionalId,
        clientId,
        description = 'Pago por servicio profesional',
        returnUrl,
        cancelUrl
      } = orderData;

      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'AUTHORIZE', // Autorizar primero, capturar después
        purchase_units: [{
          reference_id: serviceRequestId?.toString(),
          description,
          amount: {
            currency_code: currency.toUpperCase(),
            value: amount.toFixed(2)
          },
          custom_id: JSON.stringify({
            serviceRequestId: serviceRequestId?.toString(),
            professionalId: professionalId?.toString(),
            clientId: clientId?.toString()
          })
        }],
        application_context: {
          return_url: returnUrl || `${process.env.FRONTEND_URL}/payment/success`,
          cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
          brand_name: process.env.APP_NAME || 'ProServ',
          locale: 'es-CO',
          landing_page: 'BILLING',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW'
        }
      });

      const order = await this.paypalClient.execute(request);

      logger.info('Orden PayPal creada', {
        orderId: order.result.id,
        amount,
        currency,
        serviceRequestId
      });

      return {
        success: true,
        order: {
          id: order.result.id,
          status: order.result.status,
          amount,
          currency,
          approvalUrl: order.result.links.find(link => link.rel === 'approve')?.href
        }
      };
      
    } catch (error) {
      logger.error('Error creando orden PayPal', {
        error: error.message,
        amount: orderData.amount,
        serviceRequestId: orderData.serviceRequestId
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Capturar orden de PayPal
   * @param {string} orderId - ID de la orden
   * @returns {Object} Resultado de la captura
   */
  async capturePayPalOrder(orderId) {
    try {
      if (!this.paypalClient) {
        throw new Error('PayPal no está configurado');
      }

      const request = new paypal.orders.OrdersCaptureRequest(orderId);
      request.requestBody({});

      const capture = await this.paypalClient.execute(request);

      logger.info('Orden PayPal capturada', {
        orderId,
        status: capture.result.status,
        captureId: capture.result.purchase_units[0]?.payments?.captures?.[0]?.id
      });

      return {
        success: true,
        capture: {
          orderId,
          status: capture.result.status,
          captureId: capture.result.purchase_units[0]?.payments?.captures?.[0]?.id,
          amount: capture.result.purchase_units[0]?.payments?.captures?.[0]?.amount
        }
      };
      
    } catch (error) {
      logger.error('Error capturando orden PayPal', {
        orderId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Autorizar orden de PayPal
   * @param {string} orderId - ID de la orden
   * @returns {Object} Resultado de la autorización
   */
  async authorizePayPalOrder(orderId) {
    try {
      if (!this.paypalClient) {
        throw new Error('PayPal no está configurado');
      }

      const request = new paypal.orders.OrdersAuthorizeRequest(orderId);
      request.requestBody({});

      const authorization = await this.paypalClient.execute(request);

      logger.info('Orden PayPal autorizada', {
        orderId,
        status: authorization.result.status,
        authorizationId: authorization.result.purchase_units[0]?.payments?.authorizations?.[0]?.id
      });

      return {
        success: true,
        authorization: {
          orderId,
          status: authorization.result.status,
          authorizationId: authorization.result.purchase_units[0]?.payments?.authorizations?.[0]?.id,
          amount: authorization.result.purchase_units[0]?.payments?.authorizations?.[0]?.amount
        }
      };
      
    } catch (error) {
      logger.error('Error autorizando orden PayPal', {
        orderId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Capturar autorización de PayPal
   * @param {string} authorizationId - ID de la autorización
   * @param {number} amount - Cantidad a capturar
   * @param {string} currency - Moneda
   * @returns {Object} Resultado de la captura
   */
  async capturePayPalAuthorization(authorizationId, amount, currency = 'COP') {
    try {
      if (!this.paypalClient) {
        throw new Error('PayPal no está configurado');
      }

      const request = new paypal.payments.AuthorizationsCaptureRequest(authorizationId);
      request.requestBody({
        amount: {
          currency_code: currency.toUpperCase(),
          value: amount.toFixed(2)
        },
        final_capture: true
      });

      const capture = await this.paypalClient.execute(request);

      logger.info('Autorización PayPal capturada', {
        authorizationId,
        captureId: capture.result.id,
        status: capture.result.status,
        amount
      });

      return {
        success: true,
        capture: {
          authorizationId,
          captureId: capture.result.id,
          status: capture.result.status,
          amount,
          currency
        }
      };
      
    } catch (error) {
      logger.error('Error capturando autorización PayPal', {
        authorizationId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Crear reembolso PayPal
   * @param {string} captureId - ID de la captura
   * @param {number} amount - Cantidad a reembolsar
   * @param {string} currency - Moneda
   * @returns {Object} Resultado del reembolso
   */
  async createPayPalRefund(captureId, amount, currency = 'COP') {
    try {
      if (!this.paypalClient) {
        throw new Error('PayPal no está configurado');
      }

      const request = new paypal.payments.CapturesRefundRequest(captureId);
      request.requestBody({
        amount: {
          currency_code: currency.toUpperCase(),
          value: amount.toFixed(2)
        }
      });

      const refund = await this.paypalClient.execute(request);

      logger.info('Reembolso PayPal creado', {
        captureId,
        refundId: refund.result.id,
        status: refund.result.status,
        amount
      });

      return {
        success: true,
        refund: {
          captureId,
          refundId: refund.result.id,
          status: refund.result.status,
          amount,
          currency
        }
      };
      
    } catch (error) {
      logger.error('Error creando reembolso PayPal', {
        captureId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calcular comisiones de la plataforma
   * @param {number} amount - Cantidad base
   * @param {string} serviceCategory - Categoría del servicio
   * @param {boolean} isPremiumProfessional - Si es profesional premium
   * @returns {Object} Desglose de comisiones
   */
  calculatePlatformFees(amount, serviceCategory = 'general', isPremiumProfessional = false) {
    try {
      // Comisiones base por categoría
      const baseFeeRates = {
        general: 0.15, // 15%
        home_services: 0.12, // 12%
        professional_services: 0.18, // 18%
        beauty_wellness: 0.14, // 14%
        automotive: 0.13, // 13%
        technology: 0.16, // 16%
        education: 0.10, // 10%
        health: 0.20 // 20%
      };

      let feeRate = baseFeeRates[serviceCategory] || baseFeeRates.general;
      
      // Descuento para profesionales premium
      if (isPremiumProfessional) {
        feeRate *= 0.8; // 20% de descuento
      }

      const platformFee = amount * feeRate;
      const paymentProcessingFee = amount * 0.036 + 3; // 3.6% + $3 MXN
      const totalFees = platformFee + paymentProcessingFee;
      const professionalEarnings = amount - totalFees;

      return {
        originalAmount: amount,
        platformFee: Math.round(platformFee * 100) / 100,
        paymentProcessingFee: Math.round(paymentProcessingFee * 100) / 100,
        totalFees: Math.round(totalFees * 100) / 100,
        professionalEarnings: Math.round(professionalEarnings * 100) / 100,
        feeRate: Math.round(feeRate * 10000) / 100, // Porcentaje con 2 decimales
        breakdown: {
          platformFeeRate: Math.round(feeRate * 10000) / 100,
          paymentProcessingRate: 3.6,
          paymentProcessingFixed: 3,
          premiumDiscount: isPremiumProfessional ? 20 : 0
        }
      };
      
    } catch (error) {
      logger.error('Error calculando comisiones', {
        amount,
        serviceCategory,
        error: error.message
      });
      
      return {
        originalAmount: amount,
        platformFee: 0,
        paymentProcessingFee: 0,
        totalFees: 0,
        professionalEarnings: amount,
        error: error.message
      };
    }
  }

  /**
   * Validar webhook de Stripe
   * @param {string} payload - Payload del webhook
   * @param {string} signature - Firma del webhook
   * @returns {Object} Evento validado
   */
  validateStripeWebhook(payload, signature) {
    try {
      if (!this.stripeClient) {
        throw new Error('Stripe no está configurado');
      }

      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!endpointSecret) {
        throw new Error('Stripe webhook secret no configurado');
      }

      const event = this.stripeClient.webhooks.constructEvent(
        payload,
        signature,
        endpointSecret
      );

      logger.info('Webhook Stripe validado', {
        eventType: event.type,
        eventId: event.id
      });

      return {
        success: true,
        event
      };
      
    } catch (error) {
      logger.error('Error validando webhook Stripe', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validar webhook de PayPal
   * @param {Object} headers - Headers de la petición
   * @param {string} payload - Payload del webhook
   * @returns {Object} Resultado de la validación
   */
  async validatePayPalWebhook(headers, payload) {
    try {
      // Implementar validación de webhook de PayPal
      // Esto requiere verificar la firma usando el certificado de PayPal
      
      logger.info('Webhook PayPal recibido', {
        eventType: JSON.parse(payload).event_type
      });

      return {
        success: true,
        event: JSON.parse(payload)
      };
      
    } catch (error) {
      logger.error('Error validando webhook PayPal', {
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calcular comisión de la plataforma
   */
  calculatePlatformFee(amount, professional, serviceCategory) {
    let feeRate = PLATFORM_FEE_CONFIG.default;

    // Aplicar tarifa por tipo de profesional
    if (professional && professional.subscriptionPlan) {
      feeRate = PLATFORM_FEE_CONFIG.professional[professional.subscriptionPlan] || feeRate;
    }

    // Aplicar tarifa por categoría de servicio
    if (serviceCategory && PLATFORM_FEE_CONFIG.service[serviceCategory]) {
      feeRate = Math.min(feeRate, PLATFORM_FEE_CONFIG.service[serviceCategory]);
    }

    return Math.round(amount * feeRate);
  }

  /**
   * Calcular impuestos
   */
  calculateTaxes(amount, country = 'colombia') {
    const taxConfig = TAX_CONFIG[country] || TAX_CONFIG.colombia;
    
    return {
      iva: Math.round(amount * taxConfig.iva),
      retention: Math.round(amount * taxConfig.retention)
    };
  }

  /**
   * Seleccionar proveedor de pago optimizado
   */
  selectProvider(paymentMethod, currency = 'COP', amount = 0) {
    // Usar la nueva lógica de selección de proveedores
    const bestProvider = getBestProvider(paymentMethod, amount);
    
    if (bestProvider && this.providers.has(bestProvider.key)) {
      return {
        name: bestProvider.key,
        instance: this.providers.get(bestProvider.key),
        config: bestProvider.config
      };
    }

    // Fallback para pesos colombianos
    if (currency === 'COP') {
      if (this.providers.has(PAYMENT_PROVIDERS.WOMPI)) {
        return {
          name: PAYMENT_PROVIDERS.WOMPI,
          instance: this.providers.get(PAYMENT_PROVIDERS.WOMPI),
          config: PAYMENT_PROVIDERS_CONFIG.wompi
        };
      }
      if (this.providers.has(PAYMENT_PROVIDERS.MERCADOPAGO)) {
        return {
          name: PAYMENT_PROVIDERS.MERCADOPAGO,
          instance: this.providers.get(PAYMENT_PROVIDERS.MERCADOPAGO),
          config: PAYMENT_PROVIDERS_CONFIG.mercadopago
        };
      }
    }

    // Fallback general a Stripe
    if (this.providers.has(PAYMENT_PROVIDERS.STRIPE)) {
      return {
        name: PAYMENT_PROVIDERS.STRIPE,
        instance: this.providers.get(PAYMENT_PROVIDERS.STRIPE),
        config: PAYMENT_PROVIDERS_CONFIG.stripe
      };
    }

    return null;
  }

  /**
   * Obtener métodos de pago del usuario
   */
  async getUserPaymentMethods(userId) {
    try {
      const PaymentMethod = require('../models/PaymentMethod');
      
      const paymentMethods = await PaymentMethod.find({
        user: userId,
        isActive: true
      }).sort({ isDefault: -1, createdAt: -1 });

      return paymentMethods.map(method => ({
        id: method._id,
        type: method.type,
        isDefault: method.isDefault,
        details: method.getPublicDetails(),
        createdAt: method.createdAt
      }));

    } catch (error) {
      logger.error('Error getting user payment methods:', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Agregar método de pago
   */
  async addPaymentMethod(methodData) {
    try {
      const PaymentMethod = require('../models/PaymentMethod');
      
      // Si es el método por defecto, desactivar otros
      if (methodData.isDefault) {
        await PaymentMethod.updateMany(
          { user: methodData.userId },
          { isDefault: false }
        );
      }

      const paymentMethod = new PaymentMethod({
        user: methodData.userId,
        type: methodData.type,
        cardToken: methodData.cardToken,
        bankAccount: methodData.bankAccount,
        isDefault: methodData.isDefault || false,
        isActive: true
      });

      await paymentMethod.save();

      return {
        id: paymentMethod._id,
        type: paymentMethod.type,
        isDefault: paymentMethod.isDefault,
        details: paymentMethod.getPublicDetails(),
        createdAt: paymentMethod.createdAt
      };

    } catch (error) {
      logger.error('Error adding payment method:', {
        error: error.message,
        methodData
      });
      throw error;
    }
  }

  /**
   * Eliminar método de pago
   */
  async removePaymentMethod(userId, methodId) {
    try {
      const PaymentMethod = require('../models/PaymentMethod');
      
      const paymentMethod = await PaymentMethod.findOne({
        _id: methodId,
        user: userId
      });

      if (!paymentMethod) {
        throw new Error('Método de pago no encontrado');
      }

      paymentMethod.isActive = false;
      await paymentMethod.save();

      // Si era el método por defecto, establecer otro como predeterminado
      if (paymentMethod.isDefault) {
        const nextMethod = await PaymentMethod.findOne({
          user: userId,
          isActive: true,
          _id: { $ne: methodId }
        }).sort({ createdAt: -1 });

        if (nextMethod) {
          nextMethod.isDefault = true;
          await nextMethod.save();
        }
      }

      return true;

    } catch (error) {
      logger.error('Error removing payment method:', {
        error: error.message,
        userId,
        methodId
      });
      throw error;
    }
  }

  /**
   * Calcular tarifas totales de procesamiento
   */
  calculateTotalFees(providerKey, paymentMethod, amount, platformFeeRate = 0.05) {
    const processingFees = calculateProcessingFees(providerKey, paymentMethod, amount);
    const platformFee = Math.round(amount * platformFeeRate);
    const taxes = this.calculateTaxes(amount);
    
    return {
      ...processingFees,
      platformFee,
      platformFeeRate,
      iva: taxes.iva,
      retention: taxes.retention,
      totalDeductions: processingFees.totalFee + platformFee + taxes.iva + taxes.retention,
      finalNetAmount: amount - (processingFees.totalFee + platformFee + taxes.iva + taxes.retention)
    };
  }

  /**
   * Obtener estadísticas del servicio
   */
  getStats() {
    return {
      stripeConfigured: isProviderConfigured('stripe'),
      paypalConfigured: isProviderConfigured('paypal'),
      mercadopagoConfigured: isProviderConfigured('mercadopago'),
      wompiConfigured: isProviderConfigured('wompi'),
      webhookSecretsConfigured: {
        stripe: !!process.env.STRIPE_WEBHOOK_SECRET,
        paypal: !!process.env.PAYPAL_WEBHOOK_ID,
        mercadopago: !!process.env.MERCADOPAGO_WEBHOOK_SECRET,
        wompi: !!process.env.WOMPI_WEBHOOK_SECRET
      },
      supportedMethods: this.getSupportedPaymentMethods(),
      defaultCurrency: 'COP',
      defaultCountry: 'Colombia'
    };
  }

  /**
   * Obtener métodos de pago soportados
   */
  getSupportedPaymentMethods() {
    const methods = [];
    
    if (isProviderConfigured('wompi')) {
      methods.push(...PAYMENT_PROVIDERS_CONFIG.wompi.supportedMethods);
    }
    if (isProviderConfigured('mercadopago')) {
      methods.push(...PAYMENT_PROVIDERS_CONFIG.mercadopago.supportedMethods);
    }
    if (isProviderConfigured('stripe')) {
      methods.push(...PAYMENT_PROVIDERS_CONFIG.stripe.supportedMethods);
    }
    if (isProviderConfigured('paypal')) {
      methods.push(...PAYMENT_PROVIDERS_CONFIG.paypal.supportedMethods);
    }
    
    return [...new Set(methods)];
  }
}

// Instancia singleton
const paymentService = new PaymentService();

module.exports = {
  PaymentService,
  paymentService,
  PAYMENT_PROVIDERS,
  PLATFORM_FEE_CONFIG,
  TAX_CONFIG
};