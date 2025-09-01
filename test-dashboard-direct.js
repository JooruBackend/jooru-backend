const axios = require('axios');

async function testDashboard() {
  try {
    console.log('🧪 Probando endpoint del dashboard...');
    
    // Primero hacer login
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@jooru.com',
      password: 'Admin123!'
    });
    
    if (loginResponse.data.success) {
      const token = loginResponse.data.message.tokens.accessToken;
      console.log('✅ Login exitoso, token obtenido');
      
      // Probar dashboard
      const dashboardResponse = await axios.get('http://localhost:3001/api/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Dashboard response:', dashboardResponse.status);
      console.log('📊 Data:', JSON.stringify(dashboardResponse.data, null, 2));
      
    } else {
      console.error('❌ Login falló');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testDashboard();