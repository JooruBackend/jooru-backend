const axios = require('axios');
const fs = require('fs');

async function debugFrontendIssue() {
  try {
    console.log('🔍 Depurando problema del frontend...');
    
    // 1. Verificar que el backend esté funcionando
    console.log('\n1️⃣ Verificando backend...');
    // Saltamos el health check ya que no existe ese endpoint
    console.log('✅ Continuando con las pruebas...');
    
    // 2. Hacer login y obtener token
    console.log('\n2️⃣ Obteniendo token de admin...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@jooru.com',
      password: 'Admin123!'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Login falló');
    }
    
    const token = loginResponse.data.message.tokens.accessToken;
    console.log('✅ Token obtenido:', token.substring(0, 50) + '...');
    
    // 3. Guardar token en archivo temporal para el frontend
    const tokenData = {
      adminToken: token,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('admin-token-debug.json', JSON.stringify(tokenData, null, 2));
    console.log('✅ Token guardado en admin-token-debug.json');
    
    // 4. Probar endpoint del dashboard
    console.log('\n3️⃣ Probando endpoint del dashboard...');
    const dashboardResponse = await axios.get('http://localhost:3001/api/admin/dashboard', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Dashboard response status:', dashboardResponse.status);
    console.log('✅ Dashboard success:', dashboardResponse.data.success);
    
    // 5. Verificar estructura de datos
    if (dashboardResponse.data.success) {
      const data = dashboardResponse.data.message;
      console.log('\n📊 Estructura de datos del dashboard:');
      console.log('- totalUsers:', data.totalUsers);
      console.log('- totalProfessionals:', data.totalProfessionals);
      console.log('- totalRevenue:', data.totalRevenue);
      console.log('- averageRating:', data.averageRating);
      console.log('- recentActivity length:', data.recentActivity?.length || 0);
      console.log('- serviceDistribution length:', data.serviceDistribution?.length || 0);
      console.log('- monthlyBookings length:', data.monthlyBookings?.length || 0);
      console.log('- additionalStats keys:', Object.keys(data.additionalStats || {}));
    }
    
    // 6. Probar con diferentes headers
    console.log('\n4️⃣ Probando con headers del frontend...');
    const frontendResponse = await axios.get('http://localhost:3001/api/admin/dashboard', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('✅ Frontend-style request status:', frontendResponse.status);
    console.log('✅ Frontend-style request success:', frontendResponse.data.success);
    
    console.log('\n🎉 Todas las pruebas pasaron. El backend está funcionando correctamente.');
    console.log('\n💡 Si el frontend sigue mostrando error, puede ser:');
    console.log('   - Problema de cache del navegador');
    console.log('   - Token no guardado correctamente en localStorage');
    console.log('   - Error en el manejo de la respuesta en el frontend');
    
  } catch (error) {
    console.error('❌ Error en debug:', error.message);
    if (error.response) {
      console.error('📄 Status:', error.response.status);
      console.error('📄 Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugFrontendIssue();