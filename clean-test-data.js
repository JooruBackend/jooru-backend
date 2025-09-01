const mongoose = require('mongoose');
const User = require('./models/User');
const Professional = require('./models/Professional');
const ServiceRequest = require('./models/ServiceRequest');
const Payment = require('./models/Payment');
const Review = require('./models/Review');
const Notification = require('./models/Notification');
require('dotenv').config();

// Conectar a la base de datos
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
};

// Emails de usuarios de prueba para identificarlos
const testUserEmails = [
  'juan.perez@test.com',
  'maria.garcia@test.com',
  'carlos.lopez@test.com',
  'ana.martinez@professional.com',
  'pedro.rodriguez@professional.com',
  'laura.fernandez@professional.com'
];

// Función para limpiar datos de prueba
const cleanTestData = async () => {
  try {
    console.log('🧹 Iniciando limpieza de datos de prueba...');
    
    await connectDB();
    
    // Buscar usuarios de prueba
    const testUsers = await User.find({ email: { $in: testUserEmails } });
    
    if (testUsers.length === 0) {
      console.log('ℹ️  No se encontraron datos de prueba para limpiar.');
      return;
    }
    
    const testUserIds = testUsers.map(user => user._id);
    
    // Buscar profesionales de prueba
    const testProfessionals = await Professional.find({ userId: { $in: testUserIds } });
    const testProfessionalIds = testProfessionals.map(prof => prof._id);
    
    console.log(`📊 Datos de prueba encontrados:`);
    console.log(`   - Usuarios: ${testUsers.length}`);
    console.log(`   - Profesionales: ${testProfessionals.length}`);
    
    // Contar datos relacionados antes de eliminar
    const serviceRequestsCount = await ServiceRequest.countDocuments({
      $or: [
        { userId: { $in: testUserIds } },
        { professionalId: { $in: testProfessionalIds } }
      ]
    });
    
    const paymentsCount = await Payment.countDocuments({
      $or: [
        { userId: { $in: testUserIds } },
        { professionalId: { $in: testProfessionalIds } }
      ]
    });
    
    const reviewsCount = await Review.countDocuments({
      $or: [
        { userId: { $in: testUserIds } },
        { professionalId: { $in: testProfessionalIds } }
      ]
    });
    
    const notificationsCount = await Notification.countDocuments({
      userId: { $in: testUserIds }
    });
    
    console.log(`   - Solicitudes de servicio: ${serviceRequestsCount}`);
    console.log(`   - Pagos: ${paymentsCount}`);
    console.log(`   - Reseñas: ${reviewsCount}`);
    console.log(`   - Notificaciones: ${notificationsCount}`);
    
    // Confirmar eliminación
    console.log('\n⚠️  ¿Estás seguro de que quieres eliminar todos estos datos de prueba?');
    console.log('   Esta acción no se puede deshacer.');
    
    // En un entorno de producción, aquí podrías agregar una confirmación interactiva
    // Por ahora, procedemos con la eliminación
    
    console.log('\n🗑️  Eliminando datos de prueba...');
    
    // Eliminar en orden para evitar problemas de referencias
    
    // 1. Eliminar notificaciones
    const deletedNotifications = await Notification.deleteMany({
      userId: { $in: testUserIds }
    });
    console.log(`✅ Notificaciones eliminadas: ${deletedNotifications.deletedCount}`);
    
    // 2. Eliminar reseñas
    const deletedReviews = await Review.deleteMany({
      $or: [
        { userId: { $in: testUserIds } },
        { professionalId: { $in: testProfessionalIds } }
      ]
    });
    console.log(`✅ Reseñas eliminadas: ${deletedReviews.deletedCount}`);
    
    // 3. Eliminar pagos
    const deletedPayments = await Payment.deleteMany({
      $or: [
        { userId: { $in: testUserIds } },
        { professionalId: { $in: testProfessionalIds } }
      ]
    });
    console.log(`✅ Pagos eliminados: ${deletedPayments.deletedCount}`);
    
    // 4. Eliminar solicitudes de servicio
    const deletedServiceRequests = await ServiceRequest.deleteMany({
      $or: [
        { userId: { $in: testUserIds } },
        { professionalId: { $in: testProfessionalIds } }
      ]
    });
    console.log(`✅ Solicitudes de servicio eliminadas: ${deletedServiceRequests.deletedCount}`);
    
    // 5. Eliminar profesionales
    const deletedProfessionals = await Professional.deleteMany({
      userId: { $in: testUserIds }
    });
    console.log(`✅ Profesionales eliminados: ${deletedProfessionals.deletedCount}`);
    
    // 6. Eliminar usuarios
    const deletedUsers = await User.deleteMany({
      email: { $in: testUserEmails }
    });
    console.log(`✅ Usuarios eliminados: ${deletedUsers.deletedCount}`);
    
    console.log('\n🎉 ¡Limpieza de datos de prueba completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error limpiando datos de prueba:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexión a la base de datos cerrada.');
  }
};

// Función para verificar datos de prueba existentes
const checkTestData = async () => {
  try {
    await connectDB();
    
    const testUsers = await User.find({ email: { $in: testUserEmails } });
    
    if (testUsers.length === 0) {
      console.log('ℹ️  No hay datos de prueba en la base de datos.');
      return;
    }
    
    console.log(`📊 Datos de prueba encontrados: ${testUsers.length} usuarios`);
    testUsers.forEach(user => {
      console.log(`   - ${user.name} (${user.email}) - ${user.role}`);
    });
    
  } catch (error) {
    console.error('❌ Error verificando datos de prueba:', error);
  } finally {
    await mongoose.connection.close();
  }
};

// Ejecutar según argumentos de línea de comandos
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'clean':
      cleanTestData();
      break;
    case 'check':
      checkTestData();
      break;
    default:
      console.log('Uso:');
      console.log('  node clean-test-data.js check  - Verificar datos de prueba existentes');
      console.log('  node clean-test-data.js clean  - Eliminar todos los datos de prueba');
      break;
  }
}

module.exports = { cleanTestData, checkTestData };