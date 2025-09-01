const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function debugAuthDetailed() {
  try {
    console.log('=== DEBUG AUTENTICACIÓN DETALLADO ===\n');
    
    // 1. Login
    console.log('1. Haciendo login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@jooru.com',
      password: 'Admin123!'
    });
    
    console.log('Login response status:', loginResponse.status);
    console.log('Login response data:', JSON.stringify(loginResponse.data, null, 2));
    
    if (!loginResponse.data.success) {
      throw new Error('Login failed');
    }
    
    const token = loginResponse.data.message.tokens.accessToken;
    console.log('\n2. Analizando token...');
    console.log('Token length:', token.length);
    console.log('Token starts with:', token.substring(0, 20) + '...');
    
    // Decodificar token sin verificar
    const decoded = jwt.decode(token);
    console.log('Token decoded (sin verificar):', JSON.stringify(decoded, null, 2));
    
    // Verificar token con secret
    try {
      const verified = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token verified:', JSON.stringify(verified, null, 2));
    } catch (jwtError) {
      console.log('JWT verification error:', jwtError.message);
    }
    
    // 3. Probar endpoint de admin con headers detallados
    console.log('\n3. Probando endpoint /api/admin/users...');
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Admin-Debug-Script'
    };
    
    console.log('Headers enviados:', JSON.stringify(headers, null, 2));
    
    try {
      const usersResponse = await axios.get('http://localhost:3001/api/admin/users', { 
        headers,
        timeout: 10000
      });
      console.log('✓ Success! Status:', usersResponse.status);
      console.log('✓ Response data:', JSON.stringify(usersResponse.data, null, 2));
    } catch (error) {
      console.log('✗ Error details:');
      console.log('  Status:', error.response?.status);
      console.log('  Status Text:', error.response?.statusText);
      console.log('  Headers:', JSON.stringify(error.response?.headers, null, 2));
      console.log('  Data:', JSON.stringify(error.response?.data, null, 2));
      console.log('  Message:', error.message);
    }
    
    // Probar ruta de profesionales
     console.log('\n4. Probando /api/admin/professionals...');
     try {
       const profResponse = await axios.get('http://localhost:3001/api/admin/professionals', { headers });
       console.log('✓ Status:', profResponse.status);
       console.log('✓ Total profesionales:', profResponse.data.message?.professionals?.length || 0);
       console.log('✓ Primeros 3 profesionales:', JSON.stringify(profResponse.data.message?.professionals?.slice(0, 3), null, 2));
     } catch (error) {
       console.log('✗ Error en profesionales:', error.response?.status, error.response?.data?.message || error.message);
     }
     
     // Probar ruta de servicios de admin
     console.log('\n5. Probando /api/admin/services...');
     try {
       const servicesResponse = await axios.get('http://localhost:3001/api/admin/services', { headers });
       console.log('✓ Status:', servicesResponse.status);
       console.log('✓ Total servicios:', servicesResponse.data.message?.services?.length || 0);
       console.log('✓ Primeros 3 servicios:', JSON.stringify(servicesResponse.data.message?.services?.slice(0, 3), null, 2));
     } catch (error) {
       console.log('✗ Error en servicios de admin:', error.response?.status, error.response?.data?.message || error.message);
     }
    
  } catch (error) {
    console.error('Error general:', error.response?.data || error.message);
  }
}

debugAuthDetailed();