const mongoose = require('mongoose');
const User = require('./models/User');
const Professional = require('./models/Professional');
const ServiceRequest = require('./models/ServiceRequest');
const Payment = require('./models/Payment');
const Review = require('./models/Review');
require('dotenv').config();

async function checkDatabaseData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('=== DATOS REALES EN LA BASE DE DATOS ===');
    
    const totalUsers = await User.countDocuments();
    const totalProfessionals = await Professional.countDocuments();
    const totalServiceRequests = await ServiceRequest.countDocuments();
    const totalPayments = await Payment.countDocuments();
    const totalReviews = await Review.countDocuments();
    
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const avgRating = await Review.aggregate([
      { $group: { _id: null, avg: { $avg: '$rating' } } }
    ]);
    
    console.log('Total Usuarios:', totalUsers);
    console.log('Total Profesionales:', totalProfessionals);
    console.log('Total Solicitudes de Servicio:', totalServiceRequests);
    console.log('Total Pagos:', totalPayments);
    console.log('Total Reseñas:', totalReviews);
    console.log('Ingresos Totales:', totalRevenue[0]?.total || 0);
    console.log('Calificación Promedio:', avgRating[0]?.avg || 0);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDatabaseData();