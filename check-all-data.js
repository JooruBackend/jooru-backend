const mongoose = require('mongoose');
const User = require('./models/User');
const Professional = require('./models/Professional');
const ServiceRequest = require('./models/ServiceRequest');
const Payment = require('./models/Payment');
const Review = require('./models/Review');
const Notification = require('./models/Notification');
require('dotenv').config();

async function checkAllData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    
    // 1. Verificar usuarios
    const users = await User.find({}, 'email role profile.firstName profile.lastName isActive isVerified');
    console.log('\n👥 USUARIOS EN LA BASE DE DATOS:');
    console.log(`   Total: ${users.length}`);
    if (users.length > 0) {
      users.forEach(user => {
        const status = user.isActive ? '✅' : '❌';
        const verified = user.isVerified ? '✓' : '✗';
        console.log(`   ${status} ${user.email} (${user.role}) - ${user.profile.firstName} ${user.profile.lastName} [Verificado: ${verified}]`);
      });
    }
    
    // 2. Verificar profesionales
    const professionals = await Professional.find({}).populate('userId', 'email profile.firstName profile.lastName');
    console.log('\n👨‍💼 PROFESIONALES EN LA BASE DE DATOS:');
    console.log(`   Total: ${professionals.length}`);
    if (professionals.length > 0) {
      professionals.forEach(prof => {
        const user = prof.userId;
        const status = prof.isActive ? '✅' : '❌';
        const verified = prof.verification?.status || 'pending';
        console.log(`   ${status} ${user.email} - ${user.profile.firstName} ${user.profile.lastName} [Estado: ${verified}]`);
        if (prof.services && prof.services.length > 0) {
          console.log(`      Servicios: ${prof.services.map(s => s.title).join(', ')}`);
        }
      });
    }
    
    // 3. Verificar solicitudes de servicio
    const serviceRequests = await ServiceRequest.find({})
      .populate('clientId', 'email profile.firstName profile.lastName')
      .populate('professionalId', 'email profile.firstName profile.lastName');
    console.log('\n📋 SOLICITUDES DE SERVICIO EN LA BASE DE DATOS:');
    console.log(`   Total: ${serviceRequests.length}`);
    if (serviceRequests.length > 0) {
      serviceRequests.forEach(request => {
        const client = request.clientId;
        const professional = request.professionalId;
        console.log(`   📝 ${request._id} - Estado: ${request.status}`);
        console.log(`      Cliente: ${client?.profile?.firstName} ${client?.profile?.lastName} (${client?.email})`);
        if (professional) {
          console.log(`      Profesional: ${professional.profile?.firstName} ${professional.profile?.lastName} (${professional.email})`);
        }
        console.log(`      Servicio: ${request.service?.title || 'No definido'}`);
        if (request.pricing?.estimatedCost) {
          console.log(`      Costo estimado: ${request.pricing.currency || 'COP'} ${request.pricing.estimatedCost}`);
        }
        console.log(`      Creado: ${request.createdAt?.toLocaleDateString()}`);
      });
    }
    
    // 4. Verificar pagos
    const payments = await Payment.find({})
      .populate('serviceRequest', 'service.title status')
      .populate('client', 'email profile.firstName profile.lastName');
    console.log('\n💳 PAGOS EN LA BASE DE DATOS:');
    console.log(`   Total: ${payments.length}`);
    if (payments.length > 0) {
      payments.forEach(payment => {
        const client = payment.client;
        console.log(`   💰 ${payment._id} - Estado: ${payment.status}`);
        console.log(`      Cliente: ${client?.profile?.firstName} ${client?.profile?.lastName} (${client?.email})`);
        console.log(`      Monto: ${payment.currency} ${payment.amount}`);
        console.log(`      Método: ${payment.paymentMethod}`);
        if (payment.serviceRequest) {
          console.log(`      Servicio: ${payment.serviceRequest.service?.title}`);
        }
        console.log(`      Creado: ${payment.createdAt?.toLocaleDateString()}`);
      });
    }
    
    // 5. Verificar reseñas
    const reviews = await Review.find({})
      .populate('reviewerId', 'email profile.firstName profile.lastName')
      .populate('revieweeId', 'email profile.firstName profile.lastName')
      .populate('serviceRequestId', 'service.title');
    console.log('\n⭐ RESEÑAS EN LA BASE DE DATOS:');
    console.log(`   Total: ${reviews.length}`);
    if (reviews.length > 0) {
      reviews.forEach(review => {
        const reviewer = review.reviewerId;
        const reviewee = review.revieweeId;
        console.log(`   ⭐ ${review._id} - Calificación: ${review.rating?.overall}/5`);
        console.log(`      De: ${reviewer?.profile?.firstName} ${reviewer?.profile?.lastName} (${review.reviewerType})`);
        console.log(`      Para: ${reviewee?.profile?.firstName} ${reviewee?.profile?.lastName}`);
        if (review.serviceRequestId) {
          console.log(`      Servicio: ${review.serviceRequestId.service?.title}`);
        }
        console.log(`      Comentario: ${review.comment?.substring(0, 100)}${review.comment?.length > 100 ? '...' : ''}`);
        console.log(`      Creado: ${review.createdAt?.toLocaleDateString()}`);
      });
    }
    
    // 6. Verificar notificaciones
    const notifications = await Notification.find({})
      .populate('user', 'email profile.firstName profile.lastName');
    console.log('\n🔔 NOTIFICACIONES EN LA BASE DE DATOS:');
    console.log(`   Total: ${notifications.length}`);
    if (notifications.length > 0) {
      notifications.forEach(notification => {
        const user = notification.user;
        const status = notification.isRead ? '✅' : '🔔';
        console.log(`   ${status} ${notification._id} - Tipo: ${notification.type}`);
        console.log(`      Usuario: ${user?.profile?.firstName} ${user?.profile?.lastName} (${user?.email})`);
        console.log(`      Título: ${notification.title}`);
        console.log(`      Mensaje: ${notification.body?.substring(0, 100)}${notification.body?.length > 100 ? '...' : ''}`);
        console.log(`      Creado: ${notification.createdAt?.toLocaleDateString()}`);
      });
    }
    
    // Resumen
    console.log('\n📊 RESUMEN DE DATOS:');
    console.log(`   👥 Usuarios: ${users.length}`);
    console.log(`   👨‍💼 Profesionales: ${professionals.length}`);
    console.log(`   📋 Solicitudes de servicio: ${serviceRequests.length}`);
    console.log(`   💳 Pagos: ${payments.length}`);
    console.log(`   ⭐ Reseñas: ${reviews.length}`);
    console.log(`   🔔 Notificaciones: ${notifications.length}`);
    
    await mongoose.connection.close();
    console.log('\n🔌 Conexión cerrada');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAllData();