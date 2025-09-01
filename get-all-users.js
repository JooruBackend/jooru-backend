const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function getAllUsers() {
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

    console.log('🔍 Obteniendo todos los usuarios...');

    // Obtener todos los usuarios sin filtro de rol
    const usersResponse = await axios.get('http://localhost:3001/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        page: 1,
        limit: 10
      }
    });

    if (usersResponse.data.success && usersResponse.data.message.users.length > 0) {
      console.log('\n👥 TODOS LOS USUARIOS:');
      
      const clientUsers = [];
      const professionalUsers = [];
      
      usersResponse.data.message.users.forEach((user, index) => {
        console.log(`\n${index + 1}. Email: ${user.email}`);
        console.log(`   Nombre: ${user.profile?.firstName || 'N/A'} ${user.profile?.lastName || 'N/A'}`);
        console.log(`   Rol: ${user.role || 'N/A'}`);
        console.log(`   Estado: ${user.isActive ? 'Activo' : 'Inactivo'}`);
        console.log(`   Verificado: ${user.isVerified ? 'Sí' : 'No'}`);
        console.log(`   Último login: ${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Nunca'}`);
        
        // Categorizar usuarios
        if (user.role === 'user' || user.role === 'client') {
          clientUsers.push(user);
        } else if (user.role === 'professional') {
          professionalUsers.push(user);
        }
      });
      
      console.log('\n\n🎯 CREDENCIALES RECOMENDADAS:');
      
      if (clientUsers.length > 0) {
        console.log('\n👤 PARA INGRESAR COMO CLIENTE:');
        const bestClient = clientUsers.find(u => u.isActive && u.isVerified) || clientUsers[0];
        console.log(`   Email: ${bestClient.email}`);
        console.log(`   Contraseña: password123`);
        console.log(`   Estado: ${bestClient.isActive ? 'Activo' : 'Inactivo'} - ${bestClient.isVerified ? 'Verificado' : 'No verificado'}`);
      } else {
        console.log('\n👤 PARA INGRESAR COMO CLIENTE:');
        console.log('   ❌ No se encontraron usuarios con rol de cliente');
        console.log('   💡 Puedes usar cualquier usuario que no sea admin o professional');
        const nonAdminUser = usersResponse.data.message.users.find(u => u.role !== 'admin' && u.role !== 'professional');
        if (nonAdminUser) {
          console.log(`   📧 Sugerencia: ${nonAdminUser.email}`);
          console.log(`   🔑 Contraseña: password123`);
        }
      }
      
      if (professionalUsers.length > 0) {
        console.log('\n👨‍💼 PARA INGRESAR COMO PROFESIONAL:');
        const bestProfessional = professionalUsers.find(u => u.isActive && u.isVerified) || professionalUsers[0];
        console.log(`   Email: ${bestProfessional.email}`);
        console.log(`   Contraseña: password123`);
        console.log(`   Estado: ${bestProfessional.isActive ? 'Activo' : 'Inactivo'} - ${bestProfessional.isVerified ? 'Verificado' : 'No verificado'}`);
      } else {
        console.log('\n👨‍💼 PARA INGRESAR COMO PROFESIONAL:');
        console.log('   ❌ No se encontraron usuarios con rol de profesional en la lista de usuarios');
        console.log('   💡 Revisa la sección de profesionales en el admin panel');
      }
      
      console.log('\n📊 RESUMEN:');
      console.log(`   Total de usuarios: ${usersResponse.data.message.pagination?.total || 0}`);
      console.log(`   Usuarios clientes: ${clientUsers.length}`);
      console.log(`   Usuarios profesionales: ${professionalUsers.length}`);
      console.log(`   Páginas disponibles: ${usersResponse.data.message.pagination?.pages || 0}`);
      
    } else {
      console.log('No se encontraron usuarios');
    }

  } catch (error) {
    console.error('❌ Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
}

getAllUsers();