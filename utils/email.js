const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * Utilidades para envío de emails
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.templates = new Map();
    this.isConfigured = false;
  }

  /**
   * Configurar el servicio de email
   */
  async configure() {
    try {
      // Configurar transporter según el proveedor
      if (process.env.EMAIL_PROVIDER === 'gmail') {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
          }
        });
      } else if (process.env.EMAIL_PROVIDER === 'smtp') {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
          }
        });
      } else if (process.env.EMAIL_PROVIDER === 'sendgrid') {
        this.transporter = nodemailer.createTransport({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          }
        });
      } else {
        // Configuración por defecto para desarrollo
        this.transporter = nodemailer.createTransport({
          host: 'localhost',
          port: 1025,
          ignoreTLS: true
        });
      }

      // Verificar conexión
      await this.transporter.verify();
      this.isConfigured = true;
      
      logger.info('Servicio de email configurado exitosamente', {
        provider: process.env.EMAIL_PROVIDER || 'default'
      });

      // Cargar plantillas
      await this.loadTemplates();
      
    } catch (error) {
      logger.error('Error configurando servicio de email', {
        error: error.message,
        provider: process.env.EMAIL_PROVIDER
      });
      
      // En desarrollo, continuar sin email
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Continuando sin servicio de email en desarrollo');
        this.isConfigured = false;
      } else {
        throw error;
      }
    }
  }

  /**
   * Cargar plantillas de email
   */
  async loadTemplates() {
    try {
      const templatesDir = path.join(__dirname, '../templates/email');
      
      // Crear directorio si no existe
      try {
        await fs.access(templatesDir);
      } catch {
        await fs.mkdir(templatesDir, { recursive: true });
        await this.createDefaultTemplates(templatesDir);
      }

      const templateFiles = await fs.readdir(templatesDir);
      
      for (const file of templateFiles) {
        if (file.endsWith('.hbs')) {
          const templateName = path.basename(file, '.hbs');
          const templatePath = path.join(templatesDir, file);
          const templateContent = await fs.readFile(templatePath, 'utf8');
          
          this.templates.set(templateName, handlebars.compile(templateContent));
          logger.debug(`Plantilla de email cargada: ${templateName}`);
        }
      }
      
      logger.info(`${this.templates.size} plantillas de email cargadas`);
    } catch (error) {
      logger.error('Error cargando plantillas de email', { error: error.message });
    }
  }

  /**
   * Crear plantillas por defecto
   */
  async createDefaultTemplates(templatesDir) {
    const templates = {
      'welcome': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Bienvenido a ProServ</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>¡Bienvenido a ProServ!</h1>
        </div>
        <div class="content">
            <h2>Hola {{firstName}},</h2>
            <p>Gracias por registrarte en ProServ, la plataforma que conecta clientes con profesionales de servicios.</p>
            <p>Para completar tu registro, por favor verifica tu email haciendo clic en el siguiente botón:</p>
            <p style="text-align: center;">
                <a href="{{verificationUrl}}" class="button">Verificar Email</a>
            </p>
            <p>Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:</p>
            <p>{{verificationUrl}}</p>
            <p>Este enlace expirará en 24 horas.</p>
        </div>
        <div class="footer">
            <p>© 2024 ProServ. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>`,

      'password-reset': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Restablecer Contraseña - ProServ</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Restablecer Contraseña</h1>
        </div>
        <div class="content">
            <h2>Hola {{firstName}},</h2>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en ProServ.</p>
            <p>Si solicitaste este cambio, haz clic en el siguiente botón:</p>
            <p style="text-align: center;">
                <a href="{{resetUrl}}" class="button">Restablecer Contraseña</a>
            </p>
            <p>Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:</p>
            <p>{{resetUrl}}</p>
            <p>Este enlace expirará en 1 hora.</p>
            <p><strong>Si no solicitaste este cambio, ignora este email.</strong></p>
        </div>
        <div class="footer">
            <p>© 2024 ProServ. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>`,

      'service-request': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Nueva Solicitud de Servicio - ProServ</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .service-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Nueva Solicitud de Servicio</h1>
        </div>
        <div class="content">
            <h2>Hola {{professionalName}},</h2>
            <p>Tienes una nueva solicitud de servicio que coincide con tu perfil:</p>
            
            <div class="service-details">
                <h3>{{serviceTitle}}</h3>
                <p><strong>Categoría:</strong> {{category}}</p>
                <p><strong>Descripción:</strong> {{description}}</p>
                <p><strong>Ubicación:</strong> {{location}}</p>
                <p><strong>Fecha preferida:</strong> {{preferredDate}}</p>
                <p><strong>Presupuesto estimado:</strong> {{budget}}</p>
                <p><strong>Urgencia:</strong> {{urgency}}</p>
            </div>
            
            <p style="text-align: center;">
                <a href="{{viewUrl}}" class="button">Ver Solicitud</a>
            </p>
        </div>
        <div class="footer">
            <p>© 2024 ProServ. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>`,

      'quote-received': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Nueva Cotización Recibida - ProServ</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #17a2b8; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .quote-details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #17a2b8; color: white; text-decoration: none; border-radius: 5px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Nueva Cotización Recibida</h1>
        </div>
        <div class="content">
            <h2>Hola {{clientName}},</h2>
            <p>Has recibido una nueva cotización para tu solicitud de servicio:</p>
            
            <div class="quote-details">
                <h3>{{serviceTitle}}</h3>
                <p><strong>Profesional:</strong> {{professionalName}}</p>
                <p><strong>Precio:</strong> {{price}}</p>
                <p><strong>Duración estimada:</strong> {{duration}}</p>
                <p><strong>Descripción:</strong> {{description}}</p>
                <p><strong>Válida hasta:</strong> {{validUntil}}</p>
            </div>
            
            <p style="text-align: center;">
                <a href="{{viewUrl}}" class="button">Ver Cotización</a>
            </p>
        </div>
        <div class="footer">
            <p>© 2024 ProServ. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>`
    };

    for (const [name, content] of Object.entries(templates)) {
      const filePath = path.join(templatesDir, `${name}.hbs`);
      await fs.writeFile(filePath, content);
    }

    logger.info('Plantillas de email por defecto creadas');
  }

  /**
   * Enviar email
   */
  async sendEmail(to, subject, templateName, data = {}, options = {}) {
    try {
      if (!this.isConfigured) {
        logger.warn('Servicio de email no configurado, simulando envío', {
          to, subject, templateName
        });
        return { success: true, messageId: 'simulated' };
      }

      // Obtener plantilla
      const template = this.templates.get(templateName);
      if (!template) {
        throw new Error(`Plantilla '${templateName}' no encontrada`);
      }

      // Compilar plantilla con datos
      const html = template({
        ...data,
        appName: 'ProServ',
        appUrl: process.env.APP_URL || 'http://localhost:3000',
        supportEmail: process.env.SUPPORT_EMAIL || 'soporte@proserv.com'
      });

      // Configurar email
      const mailOptions = {
        from: {
          name: options.fromName || 'ProServ',
          address: options.from || process.env.EMAIL_FROM || process.env.EMAIL_USER
        },
        to,
        subject,
        html,
        ...options
      };

      // Enviar email
      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email enviado exitosamente', {
        to,
        subject,
        templateName,
        messageId: result.messageId
      });

      return {
        success: true,
        messageId: result.messageId
      };
      
    } catch (error) {
      logger.error('Error enviando email', {
        to,
        subject,
        templateName,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Enviar email de bienvenida
   */
  async sendWelcomeEmail(user, verificationToken) {
    const verificationUrl = `${process.env.APP_URL}/verify-email?token=${verificationToken}`;
    
    return await this.sendEmail(
      user.email,
      'Bienvenido a ProServ - Verifica tu email',
      'welcome',
      {
        firstName: user.firstName,
        verificationUrl
      }
    );
  }

  /**
   * Enviar email de restablecimiento de contraseña
   */
  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
    
    return await this.sendEmail(
      user.email,
      'Restablecer contraseña - ProServ',
      'password-reset',
      {
        firstName: user.firstName,
        resetUrl
      }
    );
  }

  /**
   * Enviar notificación de nueva solicitud de servicio
   */
  async sendServiceRequestNotification(professional, serviceRequest) {
    const viewUrl = `${process.env.APP_URL}/professional/requests/${serviceRequest._id}`;
    
    return await this.sendEmail(
      professional.email,
      'Nueva solicitud de servicio disponible',
      'service-request',
      {
        professionalName: professional.firstName,
        serviceTitle: serviceRequest.title,
        category: serviceRequest.category,
        description: serviceRequest.description,
        location: serviceRequest.location.address,
        preferredDate: serviceRequest.scheduling.preferredDate.toLocaleDateString(),
        budget: `${serviceRequest.pricing.estimatedCost.min}-${serviceRequest.pricing.estimatedCost.max} ${serviceRequest.pricing.currency}`,
        urgency: serviceRequest.urgency,
        viewUrl
      }
    );
  }

  /**
   * Enviar notificación de cotización recibida
   */
  async sendQuoteReceivedNotification(client, quote, serviceRequest, professional) {
    const viewUrl = `${process.env.APP_URL}/client/requests/${serviceRequest._id}/quotes`;
    
    return await this.sendEmail(
      client.email,
      'Nueva cotización recibida',
      'quote-received',
      {
        clientName: client.firstName,
        serviceTitle: serviceRequest.title,
        professionalName: professional.firstName,
        price: `${quote.price} ${quote.currency}`,
        duration: `${quote.estimatedDuration} minutos`,
        description: quote.description,
        validUntil: quote.validUntil.toLocaleDateString(),
        viewUrl
      }
    );
  }

  /**
   * Enviar email de confirmación de servicio
   */
  async sendServiceConfirmationEmail(user, serviceRequest, isClient = true) {
    const subject = isClient ? 'Servicio confirmado' : 'Servicio asignado';
    const viewUrl = `${process.env.APP_URL}/${isClient ? 'client' : 'professional'}/requests/${serviceRequest._id}`;
    
    // Usar plantilla genérica o crear una específica
    return await this.sendEmail(
      user.email,
      subject,
      'service-confirmation',
      {
        userName: user.firstName,
        serviceTitle: serviceRequest.title,
        scheduledDate: serviceRequest.scheduling.confirmedDate?.toLocaleDateString(),
        viewUrl
      }
    );
  }

  /**
   * Enviar recordatorio de servicio
   */
  async sendServiceReminderEmail(user, serviceRequest, hoursUntil) {
    return await this.sendEmail(
      user.email,
      `Recordatorio: Servicio en ${hoursUntil} horas`,
      'service-reminder',
      {
        userName: user.firstName,
        serviceTitle: serviceRequest.title,
        hoursUntil,
        scheduledDate: serviceRequest.scheduling.confirmedDate?.toLocaleString()
      }
    );
  }

  /**
   * Enviar email masivo (con rate limiting)
   */
  async sendBulkEmails(emails, subject, templateName, data = {}, batchSize = 10) {
    const results = [];
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (email) => {
        try {
          const result = await this.sendEmail(email, subject, templateName, data);
          return { email, success: true, result };
        } catch (error) {
          return { email, success: false, error: error.message };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Pausa entre lotes para evitar rate limiting
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    logger.info('Envío masivo de emails completado', {
      total: emails.length,
      successful,
      failed,
      subject,
      templateName
    });
    
    return {
      total: emails.length,
      successful,
      failed,
      results
    };
  }

  /**
   * Verificar estado del servicio
   */
  async getServiceStatus() {
    try {
      if (!this.isConfigured) {
        return { status: 'not_configured' };
      }
      
      await this.transporter.verify();
      return { status: 'operational' };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

// Instancia singleton
const emailService = new EmailService();

module.exports = {
  EmailService,
  emailService
};