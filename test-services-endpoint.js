const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

// Importar modelos
require('./models/User');
require('./models/Professional');
require('./models/ServiceRequest');

const ServiceRequest = mongoose.model('ServiceRequest');

async function testServicesEndpoint() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB Atlas');

    // 1. Verificar datos directamente en la base de datos
    console.log('\n=== Verificando datos en la base de datos ===');
    const allServiceRequests = await ServiceRequest.find({}).lean();
    console.log(`Total ServiceRequests en DB: ${allServiceRequests.length}`);
    
    if (allServiceRequests.length > 0) {
      console.log('\nPrimer ServiceRequest:');
      console.log('- ID:', allServiceRequests[0]._id);
      console.log('- Status:', allServiceRequests[0].status);
      console.log('- Service Category:', allServiceRequests[0].service?.category);
      console.log('- Service Title:', allServiceRequests[0].service?.title);
      console.log('- ClientId:', allServiceRequests[0].clientId);
      console.log('- ProfessionalId:', allServiceRequests[0].professionalId);
    }

    // 2. Probar query sin filtros
    console.log('\n=== Probando query sin filtros ===');
    const noFilterQuery = {};
    const noFilterCount = await ServiceRequest.countDocuments(noFilterQuery);
    console.log(`Count sin filtros: ${noFilterCount}`);

    // 3. Probar query con populate
    console.log('\n=== Probando query con populate ===');
    const servicesWithPopulate = await ServiceRequest.find({})
      .populate('clientId', 'profile.firstName profile.lastName email')
      .populate('professionalId', 'profile.firstName profile.lastName email')
      .limit(2)
      .lean();
    
    console.log(`Servicios con populate: ${servicesWithPopulate.length}`);
    if (servicesWithPopulate.length > 0) {
      console.log('\nPrimer servicio con populate:');
      console.log('- Client:', servicesWithPopulate[0].clientId);
      console.log('- Professional:', servicesWithPopulate[0].professionalId);
    }

    // 4. Probar el endpoint real
    console.log('\n=== Probando endpoint /api/admin/services ===');
    
    // Primero obtener token de admin
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@proserv.com',
      password: 'Admin123!'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✓ Token obtenido');
    
    // Probar endpoint sin parámetros
    const servicesResponse = await axios.get('http://localhost:3001/api/admin/services', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✓ Status:', servicesResponse.status);
    console.log('✓ Total servicios desde API:', servicesResponse.data.data.pagination.total);
    console.log('✓ Servicios devueltos:', servicesResponse.data.data.services.length);
    
    if (servicesResponse.data.data.services.length > 0) {
      console.log('\nPrimer servicio desde API:');
      const firstService = servicesResponse.data.data.services[0];
      console.log('- ID:', firstService._id);
      console.log('- Status:', firstService.status);
      console.log('- Service:', firstService.service);
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  } finally {
    await mongoose.disconnect();
  }
}

testServicesEndpoint();