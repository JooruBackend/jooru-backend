// Script para probar la conectividad del API del admin
const axios = require('axios');

const testAdminAPI = async () => {
  console.log('🧪 Probando conectividad del API del admin...');
  console.log('');
  
  const API_BASE_URL = 'http://localhost:3001/api';
  
  try {
    // Probar login del admin
    console.log('1. Probando login del administrador...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@jooru.com',
      password: 'Admin123!'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Login exitoso');
    console.log('Status:', loginResponse.status);
    console.log('Success:', loginResponse.data.success);
    console.log('Message:', loginResponse.data.message);
    
    if (loginResponse.data.data && loginResponse.data.data.tokens) {
      const token = loginResponse.data.data.tokens.accessToken;
      console.log('Token recibido:', token ? 'Sí' : 'No');
      
      // Probar endpoint de perfil con token
      console.log('');
      console.log('2. Probando endpoint de perfil...');
      
      const profileResponse = await axios.get(`${API_BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Perfil obtenido exitosamente');
      console.log('Status:', profileResponse.status);
      console.log('User role:', profileResponse.data.user?.role);
      console.log('User email:', profileResponse.data.user?.email);
    }
    
  } catch (error) {
    console.log('❌ Error en la prueba:');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data?.message || error.message);
    console.log('URL:', error.config?.url);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 El backend no está ejecutándose en el puerto 3001');
    }
  }
  
  console.log('');
  console.log('🏁 Prueba completada');
};

testAdminAPI();