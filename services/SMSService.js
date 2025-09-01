/**
 * Servicio de SMS
 * Gestiona el envío de mensajes SMS usando múltiples proveedores
 */

const logger = require('../utils/logger');

class SMSService {
  constructor() {
    this.providers = {};
    this.defaultProvider = process.env.SMS_DEFAULT_PROVIDER || 'twilio';
    
    this.initializeProviders();
  }

  /**
   * Inicializa los proveedores de SMS
   */
  initializeProviders() {
    // Twilio
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        // Validar que el accountSid tenga el formato correcto
        if (process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
          const twilio = require('twilio');
          this.providers.twilio = {
            client: twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN),
            from: process.env.TWILIO_PHONE_NUMBER
          };
          logger.info('Twilio SMS provider inicializado correctamente');
        } else {
          logger.warn('TWILIO_ACCOUNT_SID debe comenzar con "AC", omitiendo inicialización de Twilio');
        }
      } catch (error) {
        logger.error('Error inicializando Twilio SMS provider:', error.message);
      }
    }

    // AWS SNS
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      const AWS = require('aws-sdk');
      AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      });
      this.providers.sns = {
        client: new AWS.SNS({ apiVersion: '2010-03-31' })
      };
    }

    // MessageBird
    if (process.env.MESSAGEBIRD_API_KEY) {
      const messagebird = require('messagebird')(process.env.MESSAGEBIRD_API_KEY);
      this.providers.messagebird = {
        client: messagebird,
        from: process.env.MESSAGEBIRD_ORIGINATOR || 'Jooru'
      };
    }

    // Nexmo/Vonage
    if (process.env.NEXMO_API_KEY && process.env.NEXMO_API_SECRET) {
      const Nexmo = require('nexmo');
      this.providers.nexmo = {
        client: new Nexmo({
          apiKey: process.env.NEXMO_API_KEY,
          apiSecret: process.env.NEXMO_API_SECRET
        }),
        from: process.env.NEXMO_FROM || 'Jooru'
      };
    }

    // Proveedores locales colombianos
    
    // Hablame SMS (Colombia)
    if (process.env.HABLAME_API_KEY && process.env.HABLAME_ACCOUNT) {
      this.providers.hablame = {
        apiKey: process.env.HABLAME_API_KEY,
        account: process.env.HABLAME_ACCOUNT,
        baseUrl: 'https://api103.hablame.co/api/sms/v3/send/'
      };
    }

    // Masivos Colombia
    if (process.env.MASIVOS_USER && process.env.MASIVOS_PASSWORD) {
      this.providers.masivos = {
        user: process.env.MASIVOS_USER,
        password: process.env.MASIVOS_PASSWORD,
        baseUrl: 'https://www.masivos.co/api/sms'
      };
    }

    logger.info('SMS providers initialized:', {
      providers: Object.keys(this.providers),
      defaultProvider: this.defaultProvider
    });
  }

  /**
   * Envía un SMS
   */
  async sendSMS(to, message, options = {}) {
    try {
      const provider = options.provider || this.defaultProvider;
      const providerConfig = this.providers[provider];
      
      if (!providerConfig) {
        throw new Error(`SMS provider not configured: ${provider}`);
      }

      // Normalizar número de teléfono
      const normalizedPhone = this.normalizePhoneNumber(to);
      
      // Validar número
      if (!this.isValidPhoneNumber(normalizedPhone)) {
        throw new Error('Invalid phone number format');
      }

      // Truncar mensaje si es muy largo
      const truncatedMessage = this.truncateMessage(message, provider);
      
      let result;
      switch (provider) {
        case 'twilio':
          result = await this.sendWithTwilio(normalizedPhone, truncatedMessage, providerConfig, options);
          break;
        case 'sns':
          result = await this.sendWithSNS(normalizedPhone, truncatedMessage, providerConfig, options);
          break;
        case 'messagebird':
          result = await this.sendWithMessageBird(normalizedPhone, truncatedMessage, providerConfig, options);
          break;
        case 'nexmo':
          result = await this.sendWithNexmo(normalizedPhone, truncatedMessage, providerConfig, options);
          break;
        case 'hablame':
          result = await this.sendWithHablame(normalizedPhone, truncatedMessage, providerConfig, options);
          break;
        case 'masivos':
          result = await this.sendWithMasivos(normalizedPhone, truncatedMessage, providerConfig, options);
          break;
        default:
          throw new Error(`Unsupported SMS provider: ${provider}`);
      }

      logger.info('SMS sent successfully:', {
        to: normalizedPhone,
        provider,
        messageId: result.messageId,
        cost: result.cost
      });

      return result;
    } catch (error) {
      logger.error('Error sending SMS:', {
        to,
        provider: options.provider || this.defaultProvider,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Envía SMS con Twilio
   */
  async sendWithTwilio(to, message, config, options) {
    const messageOptions = {
      body: message,
      from: options.from || config.from,
      to: to
    };

    if (options.mediaUrl) {
      messageOptions.mediaUrl = options.mediaUrl;
    }

    const result = await config.client.messages.create(messageOptions);
    
    return {
      messageId: result.sid,
      status: result.status,
      cost: result.price ? parseFloat(result.price) : null,
      provider: 'twilio'
    };
  }

  /**
   * Envía SMS con AWS SNS
   */
  async sendWithSNS(to, message, config, options) {
    const params = {
      Message: message,
      PhoneNumber: to,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: options.smsType || 'Transactional'
        }
      }
    };

    if (options.senderId) {
      params.MessageAttributes['AWS.SNS.SMS.SenderID'] = {
        DataType: 'String',
        StringValue: options.senderId
      };
    }

    const result = await config.client.publish(params).promise();
    
    return {
      messageId: result.MessageId,
      status: 'sent',
      provider: 'sns'
    };
  }

  /**
   * Envía SMS con MessageBird
   */
  async sendWithMessageBird(to, message, config, options) {
    return new Promise((resolve, reject) => {
      const messageOptions = {
        originator: options.from || config.from,
        recipients: [to],
        body: message
      };

      if (options.scheduledDatetime) {
        messageOptions.scheduledDatetime = options.scheduledDatetime;
      }

      config.client.messages.create(messageOptions, (err, response) => {
        if (err) {
          reject(new Error(`MessageBird error: ${err.message}`));
        } else {
          resolve({
            messageId: response.id,
            status: response.recipients.items[0].status,
            cost: response.recipients.items[0].totalPrice,
            provider: 'messagebird'
          });
        }
      });
    });
  }

  /**
   * Envía SMS con Nexmo/Vonage
   */
  async sendWithNexmo(to, message, config, options) {
    return new Promise((resolve, reject) => {
      config.client.message.sendSms(
        options.from || config.from,
        to,
        message,
        { type: options.type || 'text' },
        (err, responseData) => {
          if (err) {
            reject(new Error(`Nexmo error: ${err.message}`));
          } else {
            const message = responseData.messages[0];
            if (message.status === '0') {
              resolve({
                messageId: message['message-id'],
                status: 'sent',
                cost: parseFloat(message['message-price']),
                provider: 'nexmo'
              });
            } else {
              reject(new Error(`Nexmo error: ${message['error-text']}`));
            }
          }
        }
      );
    });
  }

  /**
   * Envía SMS con Hablame (Colombia)
   */
  async sendWithHablame(to, message, config, options) {
    const axios = require('axios');
    
    const data = {
      account: config.account,
      apikey: config.apiKey,
      token: this.generateHablameToken(config),
      sms: [{
        numero: to,
        sms: message,
        fecha: options.scheduledDate || ''
      }]
    };

    try {
      const response = await axios.post(config.baseUrl, data, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.estado === true) {
        return {
          messageId: response.data.sms[0].id,
          status: 'sent',
          provider: 'hablame'
        };
      } else {
        throw new Error(`Hablame error: ${response.data.mensaje}`);
      }
    } catch (error) {
      throw new Error(`Hablame API error: ${error.message}`);
    }
  }

  /**
   * Envía SMS con Masivos Colombia
   */
  async sendWithMasivos(to, message, config, options) {
    const axios = require('axios');
    
    const data = {
      user: config.user,
      password: config.password,
      sms: [{
        numero: to,
        mensaje: message
      }]
    };

    try {
      const response = await axios.post(`${config.baseUrl}/send`, data, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        return {
          messageId: response.data.messageId,
          status: 'sent',
          provider: 'masivos'
        };
      } else {
        throw new Error(`Masivos error: ${response.data.message}`);
      }
    } catch (error) {
      throw new Error(`Masivos API error: ${error.message}`);
    }
  }

  /**
   * Normaliza el número de teléfono
   */
  normalizePhoneNumber(phone) {
    // Remover espacios, guiones y paréntesis
    let normalized = phone.replace(/[\s\-\(\)]/g, '');
    
    // Si es un número colombiano sin código de país, agregarlo
    if (normalized.length === 10 && normalized.startsWith('3')) {
      normalized = '+57' + normalized;
    }
    
    // Si no tiene +, agregarlo
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    
    return normalized;
  }

  /**
   * Valida el formato del número de teléfono
   */
  isValidPhoneNumber(phone) {
    // Formato internacional básico
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Trunca el mensaje según los límites del proveedor
   */
  truncateMessage(message, provider) {
    const limits = {
      twilio: 1600,
      sns: 1600,
      messagebird: 1600,
      nexmo: 1600,
      hablame: 160,
      masivos: 160
    };

    const limit = limits[provider] || 160;
    
    if (message.length > limit) {
      return message.substring(0, limit - 3) + '...';
    }
    
    return message;
  }

  /**
   * Genera token para Hablame
   */
  generateHablameToken(config) {
    const crypto = require('crypto');
    const timestamp = Math.floor(Date.now() / 1000);
    const data = config.account + config.apiKey + timestamp;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Envía SMS masivo
   */
  async sendBulkSMS(recipients, message, options = {}) {
    const results = {
      sent: [],
      failed: []
    };

    const batchSize = options.batchSize || 100;
    const delay = options.delay || 1000; // 1 segundo entre lotes

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (recipient) => {
        try {
          const result = await this.sendSMS(recipient.phone, message, {
            ...options,
            ...recipient.options
          });
          results.sent.push({ phone: recipient.phone, messageId: result.messageId });
        } catch (error) {
          results.failed.push({ phone: recipient.phone, error: error.message });
        }
      });

      await Promise.allSettled(batchPromises);
      
      // Esperar entre lotes para no sobrecargar la API
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    logger.info('Bulk SMS completed:', {
      total: recipients.length,
      sent: results.sent.length,
      failed: results.failed.length
    });

    return results;
  }

  /**
   * Verifica el estado de un mensaje
   */
  async getMessageStatus(messageId, provider) {
    try {
      const providerConfig = this.providers[provider];
      
      if (!providerConfig) {
        throw new Error(`SMS provider not configured: ${provider}`);
      }

      switch (provider) {
        case 'twilio':
          const message = await providerConfig.client.messages(messageId).fetch();
          return {
            messageId,
            status: message.status,
            errorCode: message.errorCode,
            errorMessage: message.errorMessage,
            dateCreated: message.dateCreated,
            dateSent: message.dateSent,
            price: message.price
          };
        
        // Otros proveedores pueden implementar verificación de estado
        default:
          return {
            messageId,
            status: 'unknown',
            message: 'Status check not implemented for this provider'
          };
      }
    } catch (error) {
      logger.error('Error checking message status:', {
        messageId,
        provider,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtiene estadísticas del servicio
   */
  getStats() {
    return {
      providers: Object.keys(this.providers),
      defaultProvider: this.defaultProvider,
      supportedCountries: ['CO', 'US', 'MX', 'AR', 'CL', 'PE', 'EC']
    };
  }

  /**
   * Verifica la configuración de los proveedores
   */
  async verifyConfiguration() {
    const results = {};

    for (const [provider, config] of Object.entries(this.providers)) {
      try {
        switch (provider) {
          case 'twilio':
            // Verificar cuenta de Twilio
            await config.client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
            results[provider] = { status: 'ok', message: 'Twilio account verified' };
            break;
          
          default:
            results[provider] = { status: 'ok', message: 'Provider configured' };
        }
      } catch (error) {
        results[provider] = { status: 'error', message: error.message };
      }
    }

    return results;
  }
}

module.exports = new SMSService();