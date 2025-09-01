const axios = require('axios');

// Configurar axios igual que en el frontend
const apiClient = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function testLoginFromBrowser() {
  console.log('🔍 Simulando login desde el navegador...');
  
  try {
    console.log('\n1. Intentando login con admin@jooru.com...');
    
    const response = await apiClient.post('/auth/login', {
      email: 'admin@jooru.com',
      password: 'Admin123!'
    });
    
    console.log('✅ Respuesta recibida:');
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    // Verificar la estructura exacta de la respuesta
    if (response.data.success) {
      console.log('\n🔍 Analizando estructura de respuesta:');
      console.log('response.data.success:', response.data.success);
      console.log('response.data.message:', typeof response.data.message);
      
      if (response.data.message && response.data.message.tokens) {
        console.log('✅ Tokens encontrados en response.data.message.tokens');
        console.log('AccessToken presente:', !!response.data.message.tokens.accessToken);
        console.log('User presente:', !!response.data.message.user);
      } else {
        console.log('❌ No se encontraron tokens en response.data.message');
        console.log('Estructura actual:', Object.keys(response.data.message || {}));
      }
    }
    
  } catch (error) {
    console.error('❌ Error en login:');
    console.error('Message:', error.message);
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);
    console.error('Headers:', error.response?.headers);
  }
}

testLoginFromBrowser();