const axios = require('axios');

// Simular el comportamiento del frontend admin
async function testAdminFrontendLogin() {
  try {
    console.log('=== Test de login del frontend admin ===\n');
    
    // Configurar axios como en el admin panel
    const apiClient = axios.create({
      baseURL: 'http://localhost:3001/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('1. Intentando login...');
    const loginResponse = await apiClient.post('/auth/login', {
      email: 'admin@jooru.com',
      password: 'Admin123!'
    });
    
    console.log('✅ Status:', loginResponse.status);
    console.log('✅ Success:', loginResponse.data.success);
    
    if (loginResponse.data.success) {
      // Verificar estructura de respuesta
      console.log('\n📋 Estructura de respuesta de login:');
      console.log(JSON.stringify(loginResponse.data, null, 2));
      
      // Intentar extraer token como lo hace el frontend
      const token = loginResponse.data.message?.tokens?.accessToken || 
                   loginResponse.data.data?.message?.tokens?.accessToken ||
                   loginResponse.data.data?.token ||
                   loginResponse.data.token;
      
      if (token) {
        console.log('\n✅ Token extraído exitosamente');
        console.log('Token (primeros 50 chars):', token.substring(0, 50) + '...');
        
        // Simular guardado en localStorage
        console.log('\n2. Simulando guardado en localStorage...');
        console.log('localStorage.setItem("adminToken", token)');
        
        // Configurar token en headers
        apiClient.defaults.headers.Authorization = `Bearer ${token}`;
        
        // Probar endpoint de pagos
        console.log('\n3. Probando endpoint de pagos con token...');
        const paymentsResponse = await apiClient.get('/admin/payments');
        
        console.log('✅ Pagos Status:', paymentsResponse.status);
        console.log('✅ Pagos Success:', paymentsResponse.data.success);
        console.log('✅ Total pagos:', paymentsResponse.data.data.payments.length);
        
      } else {
        console.log('\n❌ No se pudo extraer el token');
        console.log('Campos disponibles en la respuesta:');
        console.log('- loginResponse.data.message?.tokens?.accessToken:', loginResponse.data.message?.tokens?.accessToken);
        console.log('- loginResponse.data.data?.message?.tokens?.accessToken:', loginResponse.data.data?.message?.tokens?.accessToken);
        console.log('- loginResponse.data.data?.token:', loginResponse.data.data?.token);
        console.log('- loginResponse.data.token:', loginResponse.data.token);
      }
      
    } else {
      console.log('❌ Login fallido');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testAdminFrontendLogin();