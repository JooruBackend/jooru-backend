const axios = require('axios');
require('dotenv').config();

async function testLogin() {
  console.log('=== PRUEBA DE LOGIN DE USUARIOS ===\n');
  
  const baseURL = 'http://localhost:5000';
  
  // Credenciales de prueba conocidas
  const testCredentials = [
    {
      email: 'admin@jooru.com',
      password: 'admin123',
      role: 'admin',
      description: 'Usuario administrador'
    },
    {
      email: 'cliente@test.com',
      password: 'password123',
      role: 'client',
      description: 'Cliente de prueba'
    },
    {
      email: 'profesional@test.com',
      password: 'password123',
      role: 'professional',
      description: 'Profesional de prueba'
    },
    {
      email: 'test@example.com',
      password: 'test123',
      role: 'client',
      description: 'Cliente alternativo'
    }
  ];
  
  try {
    console.log('🔍 Verificando conexión al servidor...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ Servidor activo:', healthResponse.data);
    
    console.log('\n📋 Probando credenciales de login...\n');
    
    for (let i = 0; i < testCredentials.length; i++) {
      const credential = testCredentials[i];
      console.log(`${i + 1}. Probando ${credential.description}:`);
      console.log(`   Email: ${credential.email}`);
      console.log(`   Password: ${credential.password}`);
      
      try {
        const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
          email: credential.email,
          password: credential.password
        });
        
        console.log('   ✅ Login exitoso!');
        console.log('   Status:', loginResponse.status);
        console.log('   Usuario:', loginResponse.data.data?.user?.profile?.firstName || 'N/A');
        console.log('   Rol:', loginResponse.data.data?.user?.role || 'N/A');
        console.log('   Token recibido:', loginResponse.data.data?.token ? 'Sí' : 'No');
        
        // Probar endpoint protegido con el token
        if (loginResponse.data.data?.token) {
          try {
            const meResponse = await axios.get(`${baseURL}/api/auth/me`, {
              headers: {
                'Authorization': `Bearer ${loginResponse.data.data.token}`
              }
            });
            console.log('   ✅ Token válido - Endpoint /me funciona');
          } catch (meError) {
            console.log('   ❌ Token inválido - Error en endpoint /me');
          }
        }
        
      } catch (loginError) {
        console.log('   ❌ Login fallido');
        console.log('   Status:', loginError.response?.status || 'Sin respuesta');
        console.log('   Error:', loginError.response?.data?.message || loginError.message);
      }
      
      console.log('');
    }
    
    // Test de credenciales inválidas
    console.log('\n🔒 Probando credenciales inválidas...');
    try {
      const invalidResponse = await axios.post(`${baseURL}/api/auth/login`, {
        email: 'usuario@inexistente.com',
        password: 'contraseña_incorrecta'
      });
      console.log('❌ Error: Login debería haber fallado');
    } catch (invalidError) {
      console.log('✅ Error esperado - Credenciales inválidas:');
      console.log('   Status:', invalidError.response?.status);
      console.log('   Mensaje:', invalidError.response?.data?.message);
    }
    
    // Test de datos malformados
    console.log('\n📝 Probando datos malformados...');
    try {
      const malformedResponse = await axios.post(`${baseURL}/api/auth/login`, {
        email: 'email-sin-formato-valido',
        password: ''
      });
      console.log('❌ Error: Login debería haber fallado');
    } catch (malformedError) {
      console.log('✅ Error esperado - Datos malformados:');
      console.log('   Status:', malformedError.response?.status);
      console.log('   Mensaje:', malformedError.response?.data?.message);
    }
    
  } catch (error) {
    console.error('❌ Error general en las pruebas:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Sugerencia: Asegúrate de que el servidor backend esté ejecutándose en el puerto 5000');
      console.log('   Comando: npm start (en el directorio backend)');
    }
  }
}

testLogin();