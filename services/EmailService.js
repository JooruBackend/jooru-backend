const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporters = {};
    this.templates = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      await this.initializeTransporters();
      logger.info('Email service initialized successfully');
      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      // Don't throw error, just log it
      this.isInitialized = false;
    }
  }

  async initializeTransporters() {
    // SMTP (Gmail, Outlook, etc.)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        this.transporters.smtp = nodemailer.createTransporter({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        logger.info('SMTP transporter initialized');
      } catch (error) {
        logger.warn('SMTP not available:', error.message);
      }
    }

    logger.info('Email transporters initialized:', {
      providers: Object.keys(this.transporters),
      count: Object.keys(this.transporters).length
    });
  }

  async sendEmail(to, subject, htmlContent, options = {}) {
    if (!this.isInitialized) {
      logger.warn('Email service not initialized, skipping email send');
      return { success: false, message: 'Email service not available' };
    }

    const transporter = this.getAvailableTransporter();
    if (!transporter) {
      logger.warn('No email transporter available');
      return { success: false, message: 'No email provider available' };
    }

    try {
      const mailOptions = {
        from: options.from || process.env.DEFAULT_FROM_EMAIL || 'noreply@jooru.com',
        to,
        subject,
        html: htmlContent,
        ...options
      };

      const result = await transporter.sendMail(mailOptions);
      logger.info('Email sent successfully:', { to, subject, messageId: result.messageId });
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Failed to send email:', { to, subject, error: error.message });
      return { success: false, error: error.message };
    }
  }

  getAvailableTransporter() {
    const providers = Object.keys(this.transporters);
    if (providers.length === 0) return null;
    return this.transporters[providers[0]];
  }

  // Simple template methods
  async sendWelcomeEmail(to, userName) {
    const subject = '¡Bienvenido a Jooru!';
    const html = `
      <h2>¡Bienvenido a Jooru, ${userName}!</h2>
      <p>Gracias por registrarte en nuestra plataforma de servicios profesionales.</p>
      <p>Tu cuenta ha sido creada exitosamente.</p>
    `;
    return this.sendEmail(to, subject, html);
  }

  async sendNotificationEmail(to, title, body, options = {}) {
    const html = `
      <h2>${title}</h2>
      <p>${body}</p>
      ${options.actionUrl ? `<p><a href="${options.actionUrl}">Ver Detalles</a></p>` : ''}
    `;
    return this.sendEmail(to, title, html);
  }

  async sendPasswordResetEmail(to, userName, resetUrl) {
    const subject = 'Restablecer Contraseña';
    const html = `
      <h2>Restablecer Contraseña</h2>
      <p>Hola ${userName},</p>
      <p>Para restablecer tu contraseña, haz clic en el siguiente enlace:</p>
      <p><a href="${resetUrl}">Restablecer Contraseña</a></p>
    `;
    return this.sendEmail(to, subject, html);
  }

  async sendEmailVerification(to, userName, verificationUrl) {
    const subject = 'Verificar Email';
    const html = `
      <h2>Verificar Email</h2>
      <p>Hola ${userName},</p>
      <p>Para completar tu registro, necesitas verificar tu dirección de email.</p>
      <p><a href="${verificationUrl}">Verificar Email</a></p>
    `;
    return this.sendEmail(to, subject, html);
  }
}

module.exports = EmailService;