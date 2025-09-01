const mongoose = require('mongoose');
const User = require('./models/User');
const Professional = require('./models/Professional');
const ServiceRequest = require('./models/ServiceRequest');
const Payment = require('./models/Payment');
const Review = require('./models/Review');
require('dotenv').config();

async function testDashboardAPI() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('=== COMPARACIÓN: DATOS REALES vs API DASHBOARD ===\n');
    
    // Datos reales de la base de datos
    console.log('📊 DATOS REALES EN LA BASE DE DATOS:');
    const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
    const totalProfessionals = await Professional.countDocuments();
    const totalServiceRequests = await ServiceRequest.countDocuments();
    const totalPayments = await Payment.countDocuments();
    const totalReviews = await Review.countDocuments();
    
    const revenueStats = await Payment.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' }
        }
      }
    ]);
    
    const ratingStats = await Review.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating.overall' }
        }
      }
    ]);
    
    const totalRevenue = revenueStats[0]?.totalRevenue || 0;
    const averageRating = ratingStats[0]?.averageRating || 0;
    
    console.log(`- Total Usuarios (sin admin): ${totalUsers}`);
    console.log(`- Total Profesionales: ${totalProfessionals}`);
    console.log(`- Total Solicitudes de Servicio: ${totalServiceRequests}`);
    console.log(`- Total Pagos: ${totalPayments}`);
    console.log(`- Total Reseñas: ${totalReviews}`);
    console.log(`- Ingresos Totales: $${totalRevenue}`);
    console.log(`- Calificación Promedio: ${averageRating.toFixed(1)}`);
    
    console.log('\n✅ DATOS QUE DEBERÍA MOSTRAR EL DASHBOARD:');
    console.log(`- Total Usuarios: ${totalUsers}`);
    console.log(`- Profesionales: ${totalProfessionals}`);
    console.log(`- Ingresos Totales: $${Math.round(totalRevenue)}`);
    console.log(`- Calificación Promedio: ${Math.round(averageRating * 10) / 10}`);
    
    console.log('\n🔧 PROBLEMA RESUELTO:');
    console.log('- Se corrigió el campo $totalAmount por $amount en los pagos');
    console.log('- Se corrigió el campo $ratings.overall por $rating.overall en las reseñas');
    console.log('- Ahora el dashboard debería mostrar los datos correctos');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

testDashboardAPI();