const axios = require('axios');

async function testPaymentsEndpoint() {
  try {
    console.log('=== Test del endpoint de pagos ===\n');
    
    // 1. Login para obtener token
    console.log('1. Haciendo login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@jooru.com',
      password: 'Admin123!'
    });
    
    const token = loginResponse.data.message.tokens.accessToken;
    console.log('✅ Token obtenido:', token ? 'SÍ' : 'NO');
    
    // 2. Probar endpoint de pagos
    console.log('\n2. Probando endpoint /api/admin/payments...');
    const paymentsResponse = await axios.get('http://localhost:3001/api/admin/payments', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Status:', paymentsResponse.status);
    console.log('✅ Success:', paymentsResponse.data.success);
    
    if (paymentsResponse.data.success) {
      const data = paymentsResponse.data.data;
      console.log('\n📊 Resultados:');
      console.log('- Total pagos:', data.pagination.total);
      console.log('- Pagos en esta página:', data.payments.length);
      console.log('- Página actual:', data.pagination.page);
      console.log('- Total páginas:', data.pagination.pages);
      
      if (data.payments.length > 0) {
        console.log('\n🔍 Primeros 3 pagos:');
        data.payments.slice(0, 3).forEach((payment, index) => {
          console.log(`\nPago ${index + 1}:`);
          console.log('- ID:', payment._id);
          console.log('- Transaction ID:', payment.transactionId);
          console.log('- Status:', payment.status);
          console.log('- Amount:', payment.amount || payment.totalAmount);
          console.log('- Platform Fee:', payment.platformFee);
          console.log('- Cliente:', payment.client?.profile?.firstName, payment.client?.profile?.lastName);
          console.log('- Profesional:', payment.professional?.profile?.firstName, payment.professional?.profile?.lastName);
          console.log('- Método de pago:', payment.paymentMethod?.type);
          console.log('- Fecha creación:', payment.createdAt);
        });
      } else {
        console.log('\n⚠️ No se encontraron pagos');
      }
    }
    
    // 3. Probar endpoint de estadísticas
    console.log('\n3. Probando endpoint /api/admin/payments/stats...');
    const statsResponse = await axios.get('http://localhost:3001/api/admin/payments/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Stats Status:', statsResponse.status);
    console.log('✅ Stats Success:', statsResponse.data.success);
    
    if (statsResponse.data.success) {
      const stats = statsResponse.data.message.general;
      console.log('\n📈 Estadísticas:');
      console.log('- Total pagos:', stats.totalPayments);
      console.log('- Pagos completados:', stats.completedPayments);
      console.log('- Ingresos totales:', stats.totalRevenue);
      console.log('- Comisiones plataforma:', stats.totalPlatformFees);
      console.log('- Promedio por pago:', stats.avgPaymentAmount);
    }
    
    // 4. Probar con filtros
    console.log('\n4. Probando con filtros...');
    const filteredResponse = await axios.get('http://localhost:3001/api/admin/payments?page=1&limit=5&status=completed', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Con filtros - Total:', filteredResponse.data.data.pagination.total);
    console.log('✅ Con filtros - Pagos devueltos:', filteredResponse.data.data.payments.length);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testPaymentsEndpoint();