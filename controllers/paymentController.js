/**
 * Controlador para gestión de pagos y facturación
 * Maneja procesamiento de pagos, facturación y transacciones
 */

const ServiceRequest = require('../models/ServiceRequest');
const Professional = require('../models/Professional');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const { PaymentService } = require('../utils/payments');
const { NotificationService } = require('../utils/notifications');
const logger = require('../utils/logger');
const { validatePayment } = require('../utils/validation');

class PaymentController {
  /**
   * Procesar pago de un servicio
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async processPayment(req, res) {
    try {
      const { serviceRequestId } = req.params;
      const paymentData = req.body;

      // Validar datos de pago
      const validation = validatePayment(paymentData);
      if (!validation.isValid) {
        return res.validationError(validation.errors);
      }

      // Verificar que el usuario sea un cliente
      if (req.userRole !== 'client') {
        return res.forbidden('Solo los clientes pueden realizar pagos');
      }

      // Buscar la solicitud de servicio
      const serviceRequest = await ServiceRequest.findById(serviceRequestId)
        .populate('client', 'firstName lastName email')
        .populate('assignedProfessional')
        .populate('acceptedQuote');

      if (!serviceRequest) {
        return res.notFound('Solicitud de servicio no encontrada');
      }

      // Verificar que el cliente sea el propietario
      if (serviceRequest.client._id.toString() !== req.userId) {
        return res.forbidden('Solo puedes pagar tus propios servicios');
      }

      // Verificar que el servicio esté en estado válido para pago
      const validStatuses = ['assigned', 'in_progress', 'completed'];
      if (!validStatuses.includes(serviceRequest.status)) {
        return res.error('El servicio no está en un estado válido para realizar el pago', 400);
      }

      // Verificar que no haya un pago exitoso previo
      const existingPayment = await Payment.findOne({
        serviceRequest: serviceRequestId,
        status: 'completed'
      });

      if (existingPayment) {
        return res.conflict('Este servicio ya ha sido pagado');
      }

      // Calcular montos
      const serviceAmount = serviceRequest.finalPrice || serviceRequest.acceptedQuote?.price || 0;
      const platformFee = Math.round(serviceAmount * 0.05); // 5% comisión de plataforma
      const professionalAmount = serviceAmount - platformFee;
      const taxes = Math.round(serviceAmount * 0.19); // 19% IVA
      const totalAmount = serviceAmount + taxes;

      // Crear registro de pago
      const payment = new Payment({
        serviceRequest: serviceRequestId,
        client: req.userId,
        professional: serviceRequest.assignedProfessional._id,
        amount: serviceAmount,
        platformFee,
        professionalAmount,
        taxes,
        totalAmount,
        paymentMethod: paymentData.paymentMethod,
        currency: paymentData.currency || 'COP',
        description: `Pago por servicio: ${serviceRequest.title}`,
        metadata: {
          serviceCategory: serviceRequest.category,
          serviceSubcategory: serviceRequest.subcategory,
          quoteId: serviceRequest.acceptedQuote?._id
        }
      });

      await payment.save();

      try {
        // Procesar pago con el proveedor de pagos
        const paymentResult = await PaymentService.processPayment({
          amount: totalAmount,
          currency: payment.currency,
          paymentMethod: paymentData.paymentMethod,
          customer: {
            id: req.userId,
            email: serviceRequest.client.email,
            name: `${serviceRequest.client.firstName} ${serviceRequest.client.lastName}`
          },
          metadata: {
            paymentId: payment._id.toString(),
            serviceRequestId,
            type: 'service_payment'
          },
          description: payment.description
        });

        // Actualizar pago con información del proveedor
        payment.providerTransactionId = paymentResult.transactionId;
        payment.providerResponse = paymentResult;
        payment.status = paymentResult.status;
        payment.paidAt = paymentResult.status === 'completed' ? new Date() : null;

        if (paymentResult.status === 'completed') {
          // Actualizar estado del servicio
          serviceRequest.paymentStatus = 'paid';
          if (serviceRequest.status === 'completed') {
            serviceRequest.status = 'paid';
          }
          await serviceRequest.save();

          // Crear factura
          const invoice = new Invoice({
            payment: payment._id,
            serviceRequest: serviceRequestId,
            client: req.userId,
            professional: serviceRequest.assignedProfessional._id,
            invoiceNumber: await PaymentController.generateInvoiceNumber(),
            items: [{
              description: serviceRequest.title,
              quantity: 1,
              unitPrice: serviceAmount,
              total: serviceAmount
            }],
            subtotal: serviceAmount,
            taxes,
            total: totalAmount,
            currency: payment.currency,
            dueDate: new Date(),
            paidDate: new Date(),
            status: 'paid'
          });

          await invoice.save();
          payment.invoice = invoice._id;

          // Enviar notificaciones
          try {
            await NotificationService.sendPaymentCompletedNotification(
              req.userId,
              serviceRequest,
              payment
            );

            await NotificationService.sendPaymentReceivedNotification(
              serviceRequest.assignedProfessional._id,
              serviceRequest,
              payment
            );
          } catch (notifError) {
            logger.warn('Error enviando notificaciones de pago:', {
              error: notifError.message,
              paymentId: payment._id
            });
          }
        }

        await payment.save();

        logger.info('Pago procesado:', {
          paymentId: payment._id,
          serviceRequestId,
          clientId: req.userId,
          amount: totalAmount,
          status: payment.status
        });

        return res.success({
          payment: {
            _id: payment._id,
            amount: payment.amount,
            totalAmount: payment.totalAmount,
            status: payment.status,
            paymentMethod: payment.paymentMethod,
            paidAt: payment.paidAt,
            invoice: payment.invoice
          },
          serviceRequest: {
            _id: serviceRequest._id,
            status: serviceRequest.status,
            paymentStatus: serviceRequest.paymentStatus
          }
        }, 'Pago procesado exitosamente', 201);

      } catch (paymentError) {
        // Actualizar pago con error
        payment.status = 'failed';
        payment.errorMessage = paymentError.message;
        payment.providerResponse = paymentError.response || {};
        await payment.save();

        logger.error('Error procesando pago:', {
          error: paymentError.message,
          paymentId: payment._id,
          serviceRequestId
        });

        return res.error('Error procesando el pago: ' + paymentError.message, 400);
      }

    } catch (error) {
      logger.error('Error en proceso de pago:', {
        error: error.message,
        stack: error.stack,
        serviceRequestId: req.params.serviceRequestId,
        userId: req.userId
      });
      return res.serverError('Error procesando el pago');
    }
  }

  /**
   * Obtener historial de pagos del usuario
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async getPaymentHistory(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const query = {};

      // Filtrar por rol del usuario
      if (req.userRole === 'client') {
        query.client = req.userId;
      } else if (req.userRole === 'professional') {
        query.professional = req.user.professional;
      } else {
        return res.forbidden('Acceso no autorizado');
      }

      // Filtros opcionales
      if (status) {
        query.status = status;
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      // Configurar ordenamiento
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Buscar pagos
      const payments = await Payment.find(query)
        .populate('serviceRequest', 'title category status')
        .populate('client', 'firstName lastName email')
        .populate('professional', 'businessName')
        .populate('invoice', 'invoiceNumber status')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Payment.countDocuments(query);

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasNext: skip + parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      };

      return res.paginated(payments, pagination, 'Historial de pagos obtenido exitosamente');

    } catch (error) {
      logger.error('Error obteniendo historial de pagos:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId
      });
      return res.serverError('Error obteniendo el historial de pagos');
    }
  }

  /**
   * Obtener detalles de un pago específico
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async getPaymentDetails(req, res) {
    try {
      const { paymentId } = req.params;

      const payment = await Payment.findById(paymentId)
        .populate('serviceRequest', 'title description category status')
        .populate('client', 'firstName lastName email')
        .populate('professional', 'businessName')
        .populate('invoice');

      if (!payment) {
        return res.notFound('Pago no encontrado');
      }

      // Verificar permisos de acceso
      const isClient = req.userRole === 'client' && payment.client._id.toString() === req.userId;
      const isProfessional = req.userRole === 'professional' && 
        payment.professional.toString() === req.user.professional.toString();
      const isAdmin = req.userRole === 'admin';

      if (!isClient && !isProfessional && !isAdmin) {
        return res.forbidden('No tienes permisos para ver este pago');
      }

      return res.success(payment, 'Detalles del pago obtenidos exitosamente');

    } catch (error) {
      logger.error('Error obteniendo detalles del pago:', {
        error: error.message,
        stack: error.stack,
        paymentId: req.params.paymentId,
        userId: req.userId
      });
      return res.serverError('Error obteniendo los detalles del pago');
    }
  }

  /**
   * Procesar reembolso
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async processRefund(req, res) {
    try {
      const { paymentId } = req.params;
      const { reason, amount } = req.body;

      const payment = await Payment.findById(paymentId)
        .populate('serviceRequest')
        .populate('client', 'firstName lastName email')
        .populate('professional');

      if (!payment) {
        return res.notFound('Pago no encontrado');
      }

      // Verificar permisos (solo admin o en casos específicos)
      if (req.userRole !== 'admin') {
        // Permitir reembolso automático en ciertos casos
        const allowedStatuses = ['cancelled', 'disputed'];
        if (!allowedStatuses.includes(payment.serviceRequest.status)) {
          return res.forbidden('No tienes permisos para procesar este reembolso');
        }
      }

      // Verificar que el pago esté completado
      if (payment.status !== 'completed') {
        return res.error('Solo se pueden reembolsar pagos completados', 400);
      }

      // Verificar que no haya un reembolso previo
      if (payment.refundStatus === 'completed') {
        return res.conflict('Este pago ya ha sido reembolsado');
      }

      const refundAmount = amount || payment.totalAmount;

      // Validar monto de reembolso
      if (refundAmount > payment.totalAmount) {
        return res.error('El monto de reembolso no puede ser mayor al pago original', 400);
      }

      try {
        // Procesar reembolso con el proveedor de pagos
        const refundResult = await PaymentService.processRefund({
          originalTransactionId: payment.providerTransactionId,
          amount: refundAmount,
          reason,
          metadata: {
            paymentId: payment._id.toString(),
            processedBy: req.userId
          }
        });

        // Actualizar pago con información del reembolso
        payment.refundStatus = refundResult.status;
        payment.refundAmount = refundAmount;
        payment.refundReason = reason;
        payment.refundTransactionId = refundResult.transactionId;
        payment.refundedAt = refundResult.status === 'completed' ? new Date() : null;
        payment.refundResponse = refundResult;

        await payment.save();

        // Actualizar estado del servicio si es reembolso completo
        if (refundAmount === payment.totalAmount && refundResult.status === 'completed') {
          payment.serviceRequest.paymentStatus = 'refunded';
          await payment.serviceRequest.save();
        }

        // Enviar notificaciones
        try {
          await NotificationService.sendRefundProcessedNotification(
            payment.client._id,
            payment.serviceRequest,
            payment,
            refundAmount
          );

          if (payment.professional) {
            await NotificationService.sendRefundNotification(
              payment.professional._id,
              payment.serviceRequest,
              payment,
              refundAmount
            );
          }
        } catch (notifError) {
          logger.warn('Error enviando notificaciones de reembolso:', {
            error: notifError.message,
            paymentId: payment._id
          });
        }

        logger.info('Reembolso procesado:', {
          paymentId: payment._id,
          refundAmount,
          status: refundResult.status,
          processedBy: req.userId
        });

        return res.success({
          payment: {
            _id: payment._id,
            refundStatus: payment.refundStatus,
            refundAmount: payment.refundAmount,
            refundedAt: payment.refundedAt
          },
          refund: refundResult
        }, 'Reembolso procesado exitosamente');

      } catch (refundError) {
        // Actualizar pago con error de reembolso
        payment.refundStatus = 'failed';
        payment.refundErrorMessage = refundError.message;
        await payment.save();

        logger.error('Error procesando reembolso:', {
          error: refundError.message,
          paymentId: payment._id
        });

        return res.error('Error procesando el reembolso: ' + refundError.message, 400);
      }

    } catch (error) {
      logger.error('Error en proceso de reembolso:', {
        error: error.message,
        stack: error.stack,
        paymentId: req.params.paymentId,
        userId: req.userId
      });
      return res.serverError('Error procesando el reembolso');
    }
  }

  /**
   * Obtener estadísticas de pagos
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async getPaymentStats(req, res) {
    try {
      const { startDate, endDate, userRole } = req.query;
      
      let matchQuery = {};
      
      // Filtrar por usuario según rol
      if (req.userRole === 'professional') {
        matchQuery.professional = req.user.professional;
      } else if (req.userRole === 'client') {
        matchQuery.client = req.userId;
      } else if (req.userRole !== 'admin') {
        return res.forbidden('Acceso no autorizado');
      }

      // Filtro por fechas
      if (startDate || endDate) {
        matchQuery.createdAt = {};
        if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
        if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
      }

      const stats = await Payment.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalPayments: { $sum: 1 },
            completedPayments: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            failedPayments: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            },
            totalRevenue: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] }
            },
            totalRefunds: {
              $sum: { $cond: [{ $eq: ['$refundStatus', 'completed'] }, '$refundAmount', 0] }
            },
            avgPaymentAmount: { $avg: '$totalAmount' },
            totalPlatformFees: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$platformFee', 0] }
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalPayments: 0,
        completedPayments: 0,
        failedPayments: 0,
        totalRevenue: 0,
        totalRefunds: 0,
        avgPaymentAmount: 0,
        totalPlatformFees: 0
      };

      // Calcular tasas
      result.successRate = result.totalPayments > 0 
        ? (result.completedPayments / result.totalPayments * 100).toFixed(2)
        : 0;
      
      result.netRevenue = result.totalRevenue - result.totalRefunds;

      return res.success(result, 'Estadísticas de pagos obtenidas exitosamente');

    } catch (error) {
      logger.error('Error obteniendo estadísticas de pagos:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId
      });
      return res.serverError('Error obteniendo las estadísticas');
    }
  }

  /**
   * Generar número de factura único
   * @returns {String} Número de factura
   */
  static async generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Contar facturas del mes actual
    const count = await Invoice.countDocuments({
      createdAt: {
        $gte: new Date(year, new Date().getMonth(), 1),
        $lt: new Date(year, new Date().getMonth() + 1, 1)
      }
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `INV-${year}${month}-${sequence}`;
  }

  /**
   * Webhook para notificaciones de pago
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async paymentWebhook(req, res) {
    try {
      const webhookData = req.body;
      
      // Validar webhook signature
      const isValid = PaymentService.validateWebhookSignature(
        req.body,
        req.headers['x-webhook-signature']
      );

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      const { transactionId, status, metadata } = webhookData;
      
      if (metadata && metadata.paymentId) {
        const payment = await Payment.findById(metadata.paymentId);
        
        if (payment) {
          payment.status = status;
          payment.providerResponse = webhookData;
          
          if (status === 'completed') {
            payment.paidAt = new Date();
          }
          
          await payment.save();
          
          logger.info('Webhook de pago procesado:', {
            paymentId: payment._id,
            status,
            transactionId
          });
        }
      }

      return res.status(200).json({ received: true });

    } catch (error) {
      logger.error('Error procesando webhook de pago:', {
        error: error.message,
        stack: error.stack,
        body: req.body
      });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = PaymentController;