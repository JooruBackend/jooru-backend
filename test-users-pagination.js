const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testUsersPagination() {
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

    console.log('🔍 Probando paginación de usuarios...');

    // Probar página 1
    console.log('\n📄 Página 1 (limit: 10):');
    const page1Response = await axios.get('http://localhost:3001/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        page: 1,
        limit: 10
      }
    });

    console.log(`Status: ${page1Response.status}`);
    console.log(`Usuarios en página 1: ${page1Response.data.message.users.length}`);
    console.log(`Total de usuarios: ${page1Response.data.message.pagination.total}`);
    console.log(`Total de páginas: ${page1Response.data.message.pagination.pages}`);

    // Probar página 2 si existe
    if (page1Response.data.message.pagination.pages > 1) {
      console.log('\n📄 Página 2 (limit: 10):');
      const page2Response = await axios.get('http://localhost:3001/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          page: 2,
          limit: 10
        }
      });

      console.log(`Status: ${page2Response.status}`);
      console.log(`Usuarios en página 2: ${page2Response.data.message.users.length}`);
      
      // Mostrar algunos usuarios de la página 2
      if (page2Response.data.message.users.length > 0) {
        console.log('Primeros usuarios de página 2:');
        page2Response.data.message.users.slice(0, 3).forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.profile?.firstName || 'N/A'} ${user.profile?.lastName || 'N/A'} (${user.email})`);
        });
      }
    } else {
      console.log('\n📄 Solo hay 1 página de usuarios');
    }

    // Probar con limit diferente
    console.log('\n📄 Página 1 (limit: 5):');
    const page1Limit5Response = await axios.get('http://localhost:3001/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        page: 1,
        limit: 5
      }
    });

    console.log(`Status: ${page1Limit5Response.status}`);
    console.log(`Usuarios en página 1 (limit 5): ${page1Limit5Response.data.message.users.length}`);
    console.log(`Total de páginas con limit 5: ${page1Limit5Response.data.message.pagination.pages}`);

  } catch (error) {
    console.error('❌ Error completo:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code
    });
  }
}

testUsersPagination();