const axios = require('axios');
const fs = require('fs');

async function testAdminEndpoints() {
  try {
    console.log('🔍 Probando endpoints del admin con filtros...');

    // Leer token de admin
    let adminToken = '';
    try {
      const tokenData = JSON.parse(fs.readFileSync('admin-token-debug.json', 'utf8'));
      adminToken = tokenData.token;
      console.log('✅ Token de admin cargado');
    } catch (error) {
      console.log('❌ No se pudo cargar el token de admin:', error.message);
      return;
    }

    const headers = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    };

    // Probar endpoint de usuarios (solo clientes)
    console.log('\n👤 PROBANDO ENDPOINT DE USUARIOS (solo clientes):');
    try {
      const usersResponse = await axios.get('http://localhost:3001/api/admin/users', {
        params: {
          page: 1,
          limit: 10,
          role: 'client' // Filtrar solo usuarios clientes
        },
        headers
      });
      
      console.log('✅ Usuarios obtenidos exitosamente');
      console.log('Status:', usersResponse.status);
      
      if (usersResponse.data.success) {
        const users = usersResponse.data.message.users || [];
        const pagination = usersResponse.data.message.pagination || {};
        
        console.log(`📊 Total de usuarios clientes: ${pagination.total}`);
        console.log(`📄 Usuarios en esta página: ${users.length}`);
        
        // Verificar que todos sean clientes
        const roles = users.map(user => user.role);
        const uniqueRoles = [...new Set(roles)];
        console.log(`🏷️  Roles encontrados: ${uniqueRoles.join(', ')}`);
        
        if (uniqueRoles.length === 1 && uniqueRoles[0] === 'client') {
          console.log('✅ Filtro funcionando correctamente - solo clientes');
        } else {
          console.log('❌ Filtro no funcionando - se encontraron otros roles');
        }
        
        // Mostrar primeros 3 usuarios
        console.log('\n👥 Primeros usuarios:');
        users.slice(0, 3).forEach((user, index) => {
          console.log(`${index + 1}. ${user.email} (${user.role})`);
        });
      }
    } catch (error) {
      console.log('❌ Error obteniendo usuarios:');
      console.log('Status:', error.response?.status);
      console.log('Error:', error.response?.data || error.message);
    }

    // Probar endpoint de profesionales
    console.log('\n👨‍💼 PROBANDO ENDPOINT DE PROFESIONALES:');
    try {
      const professionalsResponse = await axios.get('http://localhost:3001/api/admin/professionals', {
        params: {
          page: 1,
          limit: 10
        },
        headers
      });
      
      console.log('✅ Profesionales obtenidos exitosamente');
      console.log('Status:', professionalsResponse.status);
      
      if (professionalsResponse.data.success) {
        const professionals = professionalsResponse.data.message.professionals || [];
        const pagination = professionalsResponse.data.message.pagination || {};
        
        console.log(`📊 Total de profesionales: ${pagination.total}`);
        console.log(`📄 Profesionales en esta página: ${professionals.length}`);
        
        // Mostrar primeros 3 profesionales
        console.log('\n👨‍💼 Primeros profesionales:');
        professionals.slice(0, 3).forEach((prof, index) => {
          const userName = prof.user ? `${prof.user.profile?.firstName || ''} ${prof.user.profile?.lastName || ''}`.trim() : 'N/A';
          const userEmail = prof.user?.email || 'N/A';
          console.log(`${index + 1}. ${userName} (${userEmail})`);
        });
      }
    } catch (error) {
      console.log('❌ Error obteniendo profesionales:');
      console.log('Status:', error.response?.status);
      console.log('Error:', error.response?.data || error.message);
    }

    // Probar endpoint de usuarios SIN filtro (para comparar)
    console.log('\n🔄 PROBANDO ENDPOINT DE USUARIOS SIN FILTRO (para comparar):');
    try {
      const allUsersResponse = await axios.get('http://localhost:3001/api/admin/users', {
        params: {
          page: 1,
          limit: 10
          // Sin filtro de rol
        },
        headers
      });
      
      if (allUsersResponse.data.success) {
        const allUsers = allUsersResponse.data.message.users || [];
        const pagination = allUsersResponse.data.message.pagination || {};
        
        console.log(`📊 Total de usuarios (sin filtro): ${pagination.total}`);
        console.log(`📄 Usuarios en esta página: ${allUsers.length}`);
        
        // Verificar roles mezclados
        const roles = allUsers.map(user => user.role);
        const uniqueRoles = [...new Set(roles)];
        console.log(`🏷️  Roles encontrados: ${uniqueRoles.join(', ')}`);
        
        if (uniqueRoles.length > 1) {
          console.log('✅ Sin filtro muestra roles mezclados (como esperado)');
        } else {
          console.log('ℹ️  Solo se encontró un tipo de rol');
        }
      }
    } catch (error) {
      console.log('❌ Error obteniendo todos los usuarios:', error.response?.data || error.message);
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

testAdminEndpoints();