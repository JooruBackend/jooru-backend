const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function getSampleUsers() {
  try {
    // Leer el token de admin
    const tokenPath = path.join(__dirname, 'admin-token-debug.json');
    if (!fs.existsSync(tokenPath)) {
      console.log('❌ Archivo de token no encontrado');
      return;
    }

    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const token = tokenData.adminToken;

    if (!token) {
      console.log('❌ Token no encontrado en el archivo');
      return;
    }

    console.log('🔍 Obteniendo usuarios de ejemplo...');

    // Obtener usuarios regulares
    console.log('\n👤 USUARIOS CLIENTES:');
    const usersResponse = await axios.get('http://localhost:3001/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        page: 1,
        limit: 5,
        role: 'user'
      }
    });

    if (usersResponse.data.success && usersResponse.data.message.users.length > 0) {
      usersResponse.data.message.users.forEach((user, index) => {
        console.log(`${index + 1}. Email: ${user.email}`);
        console.log(`   Nombre: ${user.profile?.firstName || 'N/A'} ${user.profile?.lastName || 'N/A'}`);
        console.log(`   Estado: ${user.isActive ? 'Activo' : 'Inactivo'}`);
        console.log(`   Verificado: ${user.isVerified ? 'Sí' : 'No'}`);
        console.log('   Contraseña sugerida: password123 (para usuarios de prueba)');
        console.log('');
      });
    } else {
      console.log('No se encontraron usuarios clientes');
    }

    // Obtener profesionales
    console.log('\n👨‍💼 USUARIOS PROFESIONALES:');
    const professionalsResponse = await axios.get('http://localhost:3001/api/admin/professionals', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        page: 1,
        limit: 5
      }
    });

    if (professionalsResponse.data.success && professionalsResponse.data.message.professionals.length > 0) {
      professionalsResponse.data.message.professionals.forEach((prof, index) => {
        console.log(`${index + 1}. Email: ${prof.user?.email || prof.email || 'N/A'}`);
        console.log(`   Nombre: ${prof.user?.profile?.firstName || prof.profile?.firstName || 'N/A'} ${prof.user?.profile?.lastName || prof.profile?.lastName || 'N/A'}`);
        console.log(`   Especialidad: ${prof.specialties?.join(', ') || 'N/A'}`);
        console.log(`   Estado: ${prof.isActive ? 'Activo' : 'Inactivo'}`);
        console.log(`   Verificado: ${prof.isVerified ? 'Sí' : 'No'}`);
        console.log('   Contraseña sugerida: password123 (para usuarios de prueba)');
        console.log('');
      });
    } else {
      console.log('No se encontraron profesionales');
    }

    // Verificar estado de paginación
    console.log('\n📊 INFORMACIÓN DE PAGINACIÓN:');
    console.log(`Total de usuarios: ${usersResponse.data.message.pagination?.total || 0}`);
    console.log(`Páginas de usuarios: ${usersResponse.data.message.pagination?.pages || 0}`);
    console.log(`Total de profesionales: ${professionalsResponse.data.message.pagination?.total || 0}`);
    console.log(`Páginas de profesionales: ${professionalsResponse.data.message.pagination?.pages || 0}`);

  } catch (error) {
    console.error('❌ Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
}

getSampleUsers();