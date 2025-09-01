const mongoose = require('mongoose');
const ServiceRequest = require('./models/ServiceRequest');
require('dotenv').config();

async function testAdminServices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB Atlas');
    
    // Contar total de servicios
    const totalServices = await ServiceRequest.countDocuments();
    console.log('\n📊 Total de ServiceRequests:', totalServices);
    
    if (totalServices > 0) {
      // Obtener algunos servicios de muestra
      const sampleServices = await ServiceRequest.find()
        .limit(3)
        .sort({ createdAt: -1 });
      
      console.log('\n📋 Servicios de muestra:');
      sampleServices.forEach((service, index) => {
        console.log(`\n${index + 1}. ID: ${service._id}`);
        console.log(`   Cliente ID: ${service.clientId}`);
        console.log(`   Profesional ID: ${service.professionalId || 'No asignado'}`);
        console.log(`   Categoría: ${service.service?.category || 'No definida'}`);
        console.log(`   Título: ${service.service?.title || 'No definido'}`);
        console.log(`   Estado: ${service.status}`);
        console.log(`   Fecha: ${service.createdAt}`);
      });
      
      // Probar consulta con filtros (simulando la función del admin)
      console.log('\n🔍 Probando consulta con paginación...');
      const query = {};
      const limit = 10;
      const skip = 0;
      
      const [services, total] = await Promise.all([
        ServiceRequest.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        ServiceRequest.countDocuments(query)
      ]);
      
      console.log(`✅ Consulta exitosa: ${services.length} servicios obtenidos de ${total} totales`);
      
    } else {
      console.log('⚠️  No hay ServiceRequests en la base de datos');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

testAdminServices();