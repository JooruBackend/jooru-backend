const mongoose = require('mongoose');
require('dotenv').config();

// Importar el modelo de usuario
const User = require('./models/User');

async function checkUserRoles() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jooru');
    console.log('✅ Conectado a MongoDB');

    // Obtener todos los roles únicos
    const roles = await User.distinct('role');
    console.log('\n🏷️  Roles únicos en la base de datos:', roles);

    // Contar usuarios por rol
    console.log('\n📊 Conteo de usuarios por rol:');
    for (const role of roles) {
      const count = await User.countDocuments({ role });
      console.log(`${role}: ${count} usuarios`);
    }

    // Mostrar algunos ejemplos de cada rol
    console.log('\n👥 Ejemplos de usuarios por rol:');
    for (const role of roles) {
      console.log(`\n--- Rol: ${role} ---`);
      const users = await User.find({ role }).limit(3).select('email role isActive isVerified');
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (Activo: ${user.isActive}, Verificado: ${user.isVerified})`);
      });
    }

    // Verificar usuarios que no son admin
    console.log('\n🔍 Usuarios no-admin:');
    const nonAdminUsers = await User.find({ role: { $ne: 'admin' } }).limit(5).select('email role');
    nonAdminUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.role})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkUserRoles();