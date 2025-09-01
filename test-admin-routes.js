const axios = require('axios');
const fs = require('fs');

async function testAdminRoutes() {
  try {
    // Primero hacer login como admin
    console.log('1. Haciendo login como admin...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@jooru.com',
      password: 'Admin123!'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Login failed');
    }
    
    const token = loginResponse.data.data.token;
    console.log('✓ Login exitoso');
    
    // Configurar headers para las siguientes peticiones
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Probar ruta de usuarios
    console.log('\n2. Probando /api/admin/users...');
    try {
      const usersResponse = await axios.get('http://localhost:3001/api/admin/users', { headers });
      console.log('✓ Status:', usersResponse.status);
      console.log('✓ Total usuarios:', usersResponse.data.data?.length || 0);
      console.log('✓ Primeros 3 usuarios:', JSON.stringify(usersResponse.data.data?.slice(0, 3), null, 2));
    } catch (error) {
      console.log('✗ Error en usuarios:', error.response?.status, error.response?.data?.message || error.message);
    }
    
    // Probar ruta de profesionales
    console.log('\n3. Probando /api/admin/professionals...');
    try {
      const profResponse = await axios.get('http://localhost:3001/api/admin/professionals', { headers });
      console.log('✓ Status:', profResponse.status);
      console.log('✓ Total profesionales:', profResponse.data.data?.length || 0);
      console.log('✓ Primeros 3 profesionales:', JSON.stringify(profResponse.data.data?.slice(0, 3), null, 2));
    } catch (error) {
      console.log('✗ Error en profesionales:', error.response?.status, error.response?.data?.message || error.message);
    }
    
    // Probar ruta de pagos
    console.log('\n4. Probando /api/admin/payments/stats...');
    try {
      const paymentsResponse = await axios.get('http://localhost:3001/api/admin/payments/stats', { headers });
      console.log('✓ Status:', paymentsResponse.status);
      console.log('✓ Datos de pagos:', JSON.stringify(paymentsResponse.data, null, 2));
    } catch (error) {
      console.log('✗ Error en pagos:', error.response?.status, error.response?.data?.message || error.message);
    }
    
  } catch (error) {
    console.error('Error general:', error.response?.data || error.message);
  }
}

testAdminRoutes();