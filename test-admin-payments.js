const axios = require('axios');
const fs = require('fs');

// Configurar axios como en el admin panel
const apiClient = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function testAdminPayments() {
  try {
    console.log('=== Test del admin panel - Pagos ===\n');
    
    // 1. Hacer login como admin
    console.log('1. Haciendo login como admin...');
    const loginResponse = await apiClient.post('/auth/login', {
      email: 'admin@jooru.com',
      password: 'Admin123!'
    });
    
    if (loginResponse.data.success) {
      console.log('✅ Login exitoso');
      
      // Extraer token
      const token = loginResponse.data.message?.tokens?.accessToken || 
                   loginResponse.data.data?.message?.tokens?.accessToken ||
                   loginResponse.data.data?.token;
      
      if (token) {
        console.log('✅ Token obtenido');
        
        // Configurar token en headers
        apiClient.defaults.headers.Authorization = `Bearer ${token}`;
        
        // 2. Probar endpoint de pagos
        console.log('\n2. Probando endpoint /api/admin/payments...');
        const paymentsResponse = await apiClient.get('/admin/payments');
        
        console.log('✅ Status:', paymentsResponse.status);
        console.log('✅ Success:', paymentsResponse.data.success);
        
        if (paymentsResponse.data.success) {
          const payments = paymentsResponse.data.data.payments;
          console.log('✅ Total pagos:', payments.length);
          
          // Mostrar estructura de datos
          if (payments.length > 0) {
            console.log('\n📊 Estructura del primer pago:');
            console.log(JSON.stringify(payments[0], null, 2));
          }
        }
        
      } else {
        console.log('❌ No se pudo obtener el token');
        console.log('Estructura de respuesta:', JSON.stringify(loginResponse.data, null, 2));
      }
      
    } else {
      console.log('❌ Login fallido');
      console.log('Respuesta:', loginResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testAdminPayments();