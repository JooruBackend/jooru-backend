const axios = require('axios');

async function testAdminLogin() {
  try {
    console.log('Probando login de admin...');
    
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@proserv.com',
      password: 'Admin123!'
    });
    
    console.log('✓ Login exitoso');
    console.log('Status:', loginResponse.status);
    console.log('Token:', loginResponse.data.data.token ? 'Presente' : 'Ausente');
    console.log('User role:', loginResponse.data.data.user?.role);
    console.log('User email:', loginResponse.data.data.user?.email);
    
    const token = loginResponse.data.data.token;
    
    // Probar endpoint protegido simple primero
    console.log('\nProbando endpoint /api/admin/dashboard...');
    const dashboardResponse = await axios.get('http://localhost:3001/api/admin/dashboard', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✓ Dashboard Status:', dashboardResponse.status);
    console.log('✓ Dashboard funcionando');
    
    // Ahora probar el endpoint de servicios
    console.log('\nProbando endpoint /api/admin/services...');
    const servicesResponse = await axios.get('http://localhost:3001/api/admin/services', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✓ Services Status:', servicesResponse.status);
    console.log('✓ Total servicios:', servicesResponse.data.data.pagination.total);
    console.log('✓ Servicios devueltos:', servicesResponse.data.data.services.length);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAdminLogin();