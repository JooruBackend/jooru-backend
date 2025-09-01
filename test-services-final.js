const axios = require('axios');

async function testServicesFinal() {
  try {
    console.log('=== Test final del endpoint de servicios ===\n');
    
    // 1. Login para obtener token
    console.log('1. Haciendo login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@jooru.com',
      password: 'Admin123!'
    });
    
    const token = loginResponse.data.message.tokens.accessToken;
    console.log('✅ Token obtenido:', token ? 'SÍ' : 'NO');
    
    // 2. Probar endpoint de servicios
    console.log('\n2. Probando endpoint /api/admin/services...');
    const servicesResponse = await axios.get('http://localhost:3001/api/admin/services', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Status:', servicesResponse.status);
    console.log('✅ Success:', servicesResponse.data.success);
    
    if (servicesResponse.data.success) {
      const data = servicesResponse.data.data;
      console.log('\n📊 Resultados:');
      console.log('- Total servicios:', data.pagination.total);
      console.log('- Servicios en esta página:', data.services.length);
      console.log('- Página actual:', data.pagination.page);
      console.log('- Total páginas:', data.pagination.pages);
      
      if (data.services.length > 0) {
        console.log('\n🔍 Primeros 3 servicios:');
        data.services.slice(0, 3).forEach((service, index) => {
          console.log(`\nServicio ${index + 1}:`);
          console.log('- ID:', service._id);
          console.log('- Status:', service.status);
          console.log('- Categoría:', service.service?.category);
          console.log('- Título:', service.service?.title);
          console.log('- Cliente:', service.clientId?.profile?.firstName, service.clientId?.profile?.lastName);
          console.log('- Profesional:', service.professionalId?.profile?.firstName, service.professionalId?.profile?.lastName);
          console.log('- Fecha creación:', service.createdAt);
        });
      } else {
        console.log('\n⚠️ No se encontraron servicios');
      }
    }
    
    // 3. Probar con filtros
    console.log('\n3. Probando con filtros...');
    const filteredResponse = await axios.get('http://localhost:3001/api/admin/services?page=1&limit=10', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Con filtros - Total:', filteredResponse.data.data.pagination.total);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testServicesFinal();