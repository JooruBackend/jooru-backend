const axios = require('axios');

async function debugStatsResponse() {
  try {
    // Login
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@jooru.com',
      password: 'Admin123!'
    });
    
    console.log('Login response structure:', JSON.stringify(loginResponse.data, null, 2));
    
    // Try different token structures
    let token;
    if (loginResponse.data.message && loginResponse.data.message.tokens) {
      token = loginResponse.data.message.tokens.accessToken;
    } else if (loginResponse.data.data && loginResponse.data.data.token) {
      token = loginResponse.data.data.token;
    } else {
      console.error('No se pudo encontrar el token en la respuesta');
      return;
    }
    
    console.log('Token obtenido:', token ? 'SÍ' : 'NO');
    
    // Test stats endpoint
    const statsResponse = await axios.get('http://localhost:3001/api/admin/payments/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('=== RESPUESTA COMPLETA ===');
    console.log(JSON.stringify(statsResponse.data, null, 2));
    
    console.log('\n=== ESTRUCTURA ===');
    console.log('success:', statsResponse.data.success);
    console.log('data:', typeof statsResponse.data.data);
    console.log('data keys:', Object.keys(statsResponse.data.data || {}));
    
    if (statsResponse.data.data && statsResponse.data.data.general) {
      console.log('general keys:', Object.keys(statsResponse.data.data.general));
      console.log('general:', statsResponse.data.data.general);
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

debugStatsResponse();