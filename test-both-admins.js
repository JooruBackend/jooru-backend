const axios = require('axios');

async function testBothAdmins() {
  try {
    console.log('=== Probando ambos usuarios admin ===\n');
    
    // Probar admin@jooru.com
    console.log('1. Probando admin@jooru.com con Admin123!...');
    try {
      const response1 = await axios.post('http://localhost:3001/api/auth/login', {
        email: 'admin@jooru.com',
        password: 'Admin123!'
      });
      
      console.log('✅ Login exitoso con admin@jooru.com');
      console.log('Status:', response1.status);
      console.log('Success:', response1.data.success);
      
      if (response1.data.success) {
        const token = response1.data.data.token;
        console.log('Token obtenido:', token ? 'SÍ' : 'NO');
        
        // Probar endpoint de servicios
        console.log('\nProbando endpoint /api/admin/services...');
        const servicesResponse = await axios.get('http://localhost:3001/api/admin/services', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('✅ Services Status:', servicesResponse.status);
        console.log('✅ Total servicios:', servicesResponse.data.data.pagination.total);
        console.log('✅ Servicios devueltos:', servicesResponse.data.data.services.length);
        
        if (servicesResponse.data.data.services.length > 0) {
          console.log('\nPrimer servicio:');
          const firstService = servicesResponse.data.data.services[0];
          console.log('- ID:', firstService._id);
          console.log('- Status:', firstService.status);
          console.log('- Service Category:', firstService.service?.category);
          console.log('- Service Title:', firstService.service?.title);
        }
        
        return;
      }
    } catch (error1) {
      console.log('❌ Error con admin@jooru.com:', error1.response?.data?.message || error1.message);
    }
    
    // Probar admin@proserv.com
    console.log('\n2. Probando admin@proserv.com con Admin123!...');
    try {
      const response2 = await axios.post('http://localhost:3001/api/auth/login', {
        email: 'admin@proserv.com',
        password: 'Admin123!'
      });
      
      console.log('✅ Login exitoso con admin@proserv.com');
      console.log('Status:', response2.status);
      console.log('Success:', response2.data.success);
    } catch (error2) {
      console.log('❌ Error con admin@proserv.com:', error2.response?.data?.message || error2.message);
    }
    
    // Probar otras contraseñas comunes
    console.log('\n3. Probando contraseñas comunes con admin@jooru.com...');
    const commonPasswords = ['admin123', 'Admin123', 'password', '123456', 'admin'];
    
    for (const password of commonPasswords) {
      try {
        const response = await axios.post('http://localhost:3001/api/auth/login', {
          email: 'admin@jooru.com',
          password: password
        });
        
        if (response.data.success) {
          console.log(`✅ Login exitoso con contraseña: ${password}`);
          return;
        }
      } catch (error) {
        console.log(`❌ Falló con contraseña: ${password}`);
      }
    }
    
  } catch (error) {
    console.error('Error general:', error.message);
  }
}

testBothAdmins();