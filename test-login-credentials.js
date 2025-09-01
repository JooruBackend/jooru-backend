const axios = require('axios');

async function testValidCredentials() {
  try {
    console.log('🔍 Probando credenciales válidas encontradas...');

    // Probar login como cliente
    console.log('\n👤 PROBANDO LOGIN COMO CLIENTE:');
    console.log('Email: usuario@ejemplo.com');
    console.log('Contraseña: password123');
    
    try {
      const clientLoginResponse = await axios.post('http://localhost:3001/api/auth/login', {
        email: 'usuario@ejemplo.com',
        password: 'password123'
      });
      
      console.log('✅ Login exitoso!');
      console.log('Status:', clientLoginResponse.status);
      console.log('Respuesta:', JSON.stringify(clientLoginResponse.data, null, 2));
      
      if (clientLoginResponse.data.success) {
        console.log('🎯 Token obtenido:', clientLoginResponse.data.message.tokens?.accessToken ? 'Sí' : 'No');
        console.log('👤 Rol del usuario:', clientLoginResponse.data.message.user?.role || 'N/A');
        console.log('📧 Email del usuario:', clientLoginResponse.data.message.user?.email || 'N/A');
      }
    } catch (clientError) {
      console.log('❌ Error en login de cliente:');
      console.log('Status:', clientError.response?.status);
      console.log('Error:', clientError.response?.data || clientError.message);
    }

    // Probar login como profesional
    console.log('\n👨‍💼 PROBANDO LOGIN COMO PROFESIONAL:');
    console.log('Email: profesional@ejemplo.com');
    console.log('Contraseña: password123');
    
    try {
      const professionalLoginResponse = await axios.post('http://localhost:3001/api/auth/login', {
        email: 'profesional@ejemplo.com',
        password: 'password123'
      });
      
      console.log('✅ Login exitoso!');
      console.log('Status:', professionalLoginResponse.status);
      console.log('Respuesta:', JSON.stringify(professionalLoginResponse.data, null, 2));
      
      if (professionalLoginResponse.data.success) {
        console.log('🎯 Token obtenido:', professionalLoginResponse.data.message.tokens?.accessToken ? 'Sí' : 'No');
        console.log('👤 Rol del usuario:', professionalLoginResponse.data.message.user?.role || 'N/A');
        console.log('📧 Email del usuario:', professionalLoginResponse.data.message.user?.email || 'N/A');
      }
    } catch (professionalError) {
      console.log('❌ Error en login de profesional:');
      console.log('Status:', professionalError.response?.status);
      console.log('Error:', professionalError.response?.data || professionalError.message);
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

testValidCredentials();