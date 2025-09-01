const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Professional = require('../models/Professional');
const { AuthUtils } = require('../utils/auth');
const { notificationService } = require('../utils/notifications');
const logger = require('../utils/logger');
const { validateData, schemas } = require('../utils/validation');

/**
 * Controlador de autenticación
 */
class AuthController {
  /**
   * Registrar nuevo usuario
   */
  static async register(req, res) {
    console.log('=== REGISTER FUNCTION START ===');
    console.log('Request body:', req.body);
    try {
      
      // Validar datos de entrada
      const { isValid, errors, data } = validateData(req.body, schemas.userRegistration);
      console.log('Validation result:', { isValid, errors, data });
      
      if (!isValid) {
        return res.badRequest('Datos de registro inválidos', { errors });
      }

      const { email, password, role, profile, businessInfo } = data;
      console.log('Extracted data:', { email, password: '***', role, profile, businessInfo });

      // Verificar si el usuario ya existe
      console.log('Checking existing user for email:', email);
      const existingUser = await User.findByEmail(email);
      console.log('Existing user result:', existingUser);
      if (existingUser) {
        return res.conflict('El email ya está registrado');
      }

      // Crear usuario
      const userData = {
        email,
        password,
        role,
        profile,
        verificationToken: crypto.randomBytes(32).toString('hex'),
        verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
      };
      console.log('Creating user with data:', userData);

      const user = new User(userData);
      console.log('User instance created:', user);
      console.log('User email before save:', user.email);
      console.log('User object before save:', JSON.stringify(user.toObject(), null, 2));
      
      try {
        await user.save();
        console.log('User saved successfully');
      } catch (saveError) {
        console.log('Error saving user:', saveError.message);
        console.log('Error stack:', saveError.stack);
        throw saveError;
      }
      
      console.log('After save block - User exists:', user ? 'yes' : 'no');
      console.log('After save block - User email:', user ? user.email : 'user is undefined');

      // Si es profesional, crear perfil profesional
      let professional = null;
      if (role === 'professional' && businessInfo) {
        console.log('Creating professional profile...');
        professional = new Professional({
          userId: user._id,
          businessInfo,
          services: [],
          availability: {
            schedule: {
              monday: { isAvailable: false, timeSlots: [] },
              tuesday: { isAvailable: false, timeSlots: [] },
              wednesday: { isAvailable: false, timeSlots: [] },
              thursday: { isAvailable: false, timeSlots: [] },
              friday: { isAvailable: false, timeSlots: [] },
              saturday: { isAvailable: false, timeSlots: [] },
              sunday: { isAvailable: false, timeSlots: [] }
            }
          }
        });
        await professional.save();
        console.log('Professional profile created');
      }
      
      console.log('Before email - User exists:', user ? 'yes' : 'no');
      console.log('Before email - User email:', user ? user.email : 'user is undefined');

      // Enviar email de verificación
      await notificationService.emailService.sendWelcomeEmail(
        user.email,
        {
          user,
          verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${user.verificationToken}`
        }
      );

      // Generar tokens
      const accessToken = user.generateAuthToken();
      const refreshToken = user.generateRefreshToken();

      // Guardar refresh token
      user.refreshTokens.push({
        token: refreshToken,
        createdAt: new Date(),
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      });
      await user.save();

      logger.info('Usuario registrado exitosamente', {
        userId: user._id,
        email: user.email,
        role: user.role,
        hasProfessionalProfile: !!professional
      });

      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: {
          user: user.getPublicProfile(),
          professional: professional ? {
            id: professional._id,
            businessName: professional.businessInfo.businessName,
            isVerified: professional.verification.isVerified
          } : null,
          tokens: {
            accessToken,
            refreshToken
          },
          requiresEmailVerification: true
        }
      });

    } catch (error) {
      console.log('Caught error in register:', error.message);
      console.log('Error stack:', error.stack);
      logger.error('Error en registro de usuario', {
        error: error.message,
        email: (req.body && req.body.email) ? req.body.email : 'unknown',
        role: (req.body && req.body.role) ? req.body.role : 'unknown'
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Iniciar sesión
   */
  static async login(req, res) {
    try {
      // Validar datos de entrada
      const { isValid, errors, data } = validateData(req.body, schemas.userLogin);
      if (!isValid) {
        return res.badRequest('Datos de login inválidos', { errors });
      }

      const { email, password, deviceToken } = data;

      // Buscar usuario
      const user = await User.findByEmail(email);
      if (!user) {
        return res.unauthorized('Credenciales inválidas');
      }

      // Verificar si la cuenta está bloqueada
      if (user.isAccountLocked) {
        return res.forbidden('Cuenta bloqueada por múltiples intentos fallidos');
      }

      // Verificar contraseña
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        await user.incLoginAttempts();
        return res.unauthorized('Credenciales inválidas');
      }

      // Resetear intentos fallidos
      await user.resetLoginAttempts();

      // Actualizar último login
      user.lastLogin = new Date();
      
      // Agregar/actualizar device token si se proporciona
      if (deviceToken) {
        user.addDeviceToken(deviceToken, req.get('User-Agent'));
      }

      // Generar tokens
      const accessToken = user.generateAuthToken();
      const refreshToken = user.generateRefreshToken();

      // Guardar refresh token
      user.refreshTokens.push({
        token: refreshToken,
        createdAt: new Date(),
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      });

      await user.save();

      // Obtener perfil profesional si aplica
      let professional = null;
      if (user.role === 'professional') {
        professional = await Professional.findOne({ userId: user._id });
      }

      logger.info('Usuario inició sesión exitosamente', {
        userId: user._id,
        email: user.email,
        role: user.role,
        ipAddress: req.ip
      });

      res.success('Login exitoso', {
        user: user.getPublicProfile(),
        professional: professional ? {
          id: professional._id,
          businessName: professional.businessInfo.businessName,
          isVerified: professional.verification.isVerified,
          completionRate: professional.completionRate,
          rating: professional.rating.average
        } : null,
        tokens: {
          accessToken,
          refreshToken
        },
        requiresEmailVerification: !user.isVerified
      });

    } catch (error) {
      logger.error('Error en login', {
        error: error.message,
        email: req.body.email
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Renovar token de acceso
   */
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.badRequest('Refresh token requerido');
      }

      // Verificar refresh token
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      } catch (error) {
        return res.unauthorized('Refresh token inválido');
      }

      // Buscar usuario
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.unauthorized('Usuario no encontrado');
      }

      // Verificar que el refresh token existe en la base de datos
      const tokenExists = user.refreshTokens.some(token => token.token === refreshToken);
      if (!tokenExists) {
        return res.unauthorized('Refresh token no válido');
      }

      // Generar nuevo access token
      const newAccessToken = user.generateAuthToken();

      logger.info('Token renovado exitosamente', {
        userId: user._id,
        email: user.email
      });

      res.success('Token renovado exitosamente', {
        accessToken: newAccessToken
      });

    } catch (error) {
      logger.error('Error renovando token', {
        error: error.message
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Cerrar sesión
   */
  static async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      const user = req.user;

      if (refreshToken) {
        // Remover refresh token específico
        user.refreshTokens = user.refreshTokens.filter(
          token => token.token !== refreshToken
        );
      } else {
        // Remover todos los refresh tokens (logout de todos los dispositivos)
        user.refreshTokens = [];
      }

      await user.save();

      logger.info('Usuario cerró sesión', {
        userId: user._id,
        email: user.email,
        logoutType: refreshToken ? 'single_device' : 'all_devices'
      });

      res.success('Sesión cerrada exitosamente');

    } catch (error) {
      logger.error('Error cerrando sesión', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Verificar email
   */
  static async verifyEmail(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.badRequest('Token de verificación requerido');
      }

      // Buscar usuario con el token
      const user = await User.findOne({
        verificationToken: token,
        verificationTokenExpires: { $gt: new Date() }
      });

      if (!user) {
        return res.badRequest('Token de verificación inválido o expirado');
      }

      // Marcar email como verificado
      user.isVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;

      await user.save();

      logger.info('Email verificado exitosamente', {
        userId: user._id,
        email: user.email
      });

      res.success('Email verificado exitosamente');

    } catch (error) {
      logger.error('Error verificando email', {
        error: error.message
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Reenviar email de verificación
   */
  static async resendVerificationEmail(req, res) {
    try {
      const user = req.user;

      if (user.isVerified) {
        return res.badRequest('El email ya está verificado');
      }

      // Generar nuevo token
      user.verificationToken = crypto.randomBytes(32).toString('hex');
      user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await user.save();

      // Enviar email
      await notificationService.emailService.sendWelcomeEmail(
        user.email,
        {
          user,
          verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${user.verificationToken}`
        }
      );

      logger.info('Email de verificación reenviado', {
        userId: user._id,
        email: user.email
      });

      res.success('Email de verificación enviado');

    } catch (error) {
      logger.error('Error reenviando email de verificación', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Solicitar recuperación de contraseña
   */
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.badRequest('Email requerido');
      }

      const user = await User.findByEmail(email);
      if (!user) {
        // Por seguridad, no revelar si el email existe
        return res.success('Si el email existe, recibirás instrucciones para recuperar tu contraseña');
      }

      // Generar token de recuperación
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.passwordReset = {
        token: resetToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
        requestedAt: new Date()
      };

      await user.save();

      // Enviar email de recuperación
      await notificationService.emailService.sendPasswordResetEmail(
        user.email,
        {
          user,
          resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
        }
      );

      logger.info('Solicitud de recuperación de contraseña', {
        userId: user._id,
        email: user.email
      });

      res.success('Si el email existe, recibirás instrucciones para recuperar tu contraseña');

    } catch (error) {
      logger.error('Error en solicitud de recuperación de contraseña', {
        error: error.message,
        email: req.body.email
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Restablecer contraseña
   */
  static async resetPassword(req, res) {
    try {
      // Validar datos
      const { isValid, errors, data } = validateData(req.body, schemas.passwordReset);
      if (!isValid) {
        return res.badRequest('Datos inválidos', { errors });
      }

      const { token, newPassword } = data;

      // Buscar usuario con el token
      const user = await User.findOne({
        'passwordReset.token': token,
        'passwordReset.expiresAt': { $gt: new Date() }
      });

      if (!user) {
        return res.badRequest('Token de recuperación inválido o expirado');
      }

      // Actualizar contraseña
      user.password = newPassword;
      user.passwordReset = undefined;
      
      // Invalidar todos los refresh tokens
      user.refreshTokens = [];

      await user.save();

      logger.info('Contraseña restablecida exitosamente', {
        userId: user._id,
        email: user.email
      });

      res.success('Contraseña restablecida exitosamente');

    } catch (error) {
      logger.error('Error restableciendo contraseña', {
        error: error.message
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Cambiar contraseña (usuario autenticado)
   */
  static async changePassword(req, res) {
    try {
      // Validar datos
      const { isValid, errors, data } = validateData(req.body, schemas.passwordChange);
      if (!isValid) {
        return res.badRequest('Datos inválidos', { errors });
      }

      const { currentPassword, newPassword } = data;
      const user = req.user;

      // Verificar contraseña actual
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.badRequest('Contraseña actual incorrecta');
      }

      // Actualizar contraseña
      user.password = newPassword;
      await user.save();

      logger.info('Contraseña cambiada exitosamente', {
        userId: user._id,
        email: user.email
      });

      res.success('Contraseña cambiada exitosamente');

    } catch (error) {
      logger.error('Error cambiando contraseña', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Obtener perfil del usuario autenticado
   */
  static async getProfile(req, res) {
    try {
      const user = req.user;
      
      // Obtener perfil profesional si aplica
      let professional = null;
      if (user.role === 'professional') {
        professional = await Professional.findOne({ userId: user._id })
          .populate('services.reviews', 'rating comment client createdAt')
          .lean();
      }

      res.success('Perfil obtenido exitosamente', {
        user: user.getPublicProfile(),
        professional: professional ? {
          ...professional,
          completionRate: professional.completionRate,
          isCurrentlyAvailable: professional.isCurrentlyAvailable
        } : null
      });

    } catch (error) {
      logger.error('Error obteniendo perfil', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Actualizar device token para notificaciones push
   */
  static async updateDeviceToken(req, res) {
    try {
      const { deviceToken, platform } = req.body;
      const user = req.user;

      if (!deviceToken) {
        return res.badRequest('Device token requerido');
      }

      user.addDeviceToken(deviceToken, platform || req.get('User-Agent'));
      await user.save();

      logger.info('Device token actualizado', {
        userId: user._id,
        platform
      });

      res.success('Device token actualizado exitosamente');

    } catch (error) {
      logger.error('Error actualizando device token', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }

  /**
   * Eliminar cuenta de usuario
   */
  static async deleteAccount(req, res) {
    try {
      const { password } = req.body;
      const user = req.user;

      if (!password) {
        return res.badRequest('Contraseña requerida para eliminar la cuenta');
      }

      // Verificar contraseña
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.badRequest('Contraseña incorrecta');
      }

      // Eliminar perfil profesional si existe
      if (user.role === 'professional') {
        await Professional.findOneAndDelete({ userId: user._id });
      }

      // Marcar usuario como eliminado (soft delete)
      user.isActive = false;
      user.deletedAt = new Date();
      user.email = `deleted_${Date.now()}_${user.email}`;
      await user.save();

      logger.info('Cuenta de usuario eliminada', {
        userId: user._id,
        email: user.email,
        role: user.role
      });

      res.success('Cuenta eliminada exitosamente');

    } catch (error) {
      logger.error('Error eliminando cuenta', {
        error: error.message,
        userId: req.user?._id
      });
      res.serverError('Error interno del servidor');
    }
  }
}

module.exports = AuthController;