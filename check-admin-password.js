const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Importar el modelo User
const User = require('./models/User');

async function checkAdminPassword() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Buscar el usuario admin (incluyendo el campo password)
    const admin = await User.findOne({ email: 'admin@jooru.com' }).select('+password');
    
    if (!admin) {
      console.log('❌ Usuario admin@jooru.com no encontrado');
      return;
    }

    console.log('\n📋 Información del usuario admin:');
    console.log(`   📧 Email: ${admin.email}`);
    console.log(`   👤 Nombre: ${admin.profile?.firstName || 'No definido'} ${admin.profile?.lastName || ''}`);
    console.log(`   🔑 Rol: ${admin.role}`);
    console.log(`   ✅ Verificado: ${admin.isVerified ? '✓' : '✗'}`);
    console.log(`   🟢 Activo: ${admin.isActive ? '✓' : '✗'}`);
    
    // Mostrar el hash de la contraseña (primeros y últimos caracteres por seguridad)
    const passwordHash = admin.password;
    const hashPreview = passwordHash.substring(0, 10) + '...' + passwordHash.substring(passwordHash.length - 10);
    console.log(`   🔐 Hash de contraseña: ${hashPreview}`);
    
    // Verificar si la contraseña por defecto funciona
    const defaultPassword = 'Admin123!';
    const isValidPassword = await bcrypt.compare(defaultPassword, admin.password);
    
    console.log('\n🔍 Verificación de contraseña:');
    console.log(`   🔑 Contraseña por defecto (${defaultPassword}): ${isValidPassword ? '✅ VÁLIDA' : '❌ INVÁLIDA'}`);
    
    if (isValidPassword) {
      console.log('\n✅ La contraseña del administrador es: Admin123!');
    } else {
      console.log('\n⚠️  La contraseña ha sido cambiada desde la configuración por defecto.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Conexión cerrada');
  }
}

checkAdminPassword();