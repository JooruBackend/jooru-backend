const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Importar el modelo de Usuario
const User = require('./models/User');

/**
 * Script para crear un usuario administrador por defecto
 * Ejecutar con: node create-admin.js
 */

async function createAdminUser() {
  try {
    // Conectar a la base de datos
    console.log('Conectando a la base de datos...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Verificar si ya existe un usuario administrador
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('⚠️  Ya existe un usuario administrador:');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Nombre: ${existingAdmin.profile.firstName} ${existingAdmin.profile.lastName}`);
      console.log('\n💡 Puedes usar estas credenciales para acceder al panel de administración.');
      return;
    }

    // Datos del administrador por defecto
    const adminData = {
      email: 'admin@jooru.com',
      password: 'Admin123!', // Se hasheará automáticamente por el middleware
      role: 'admin',
      profile: {
        firstName: 'Administrador',
        lastName: 'Jooru',
        phone: '+573001234567'
      },
      isVerified: true,
      isActive: true,
      preferences: {
        language: 'es',
        currency: 'COP'
      }
    };

    // Crear el usuario administrador
    console.log('Creando usuario administrador...');
    const admin = new User(adminData);
    await admin.save();

    console.log('\n🎉 Usuario administrador creado exitosamente!');
    console.log('\n📋 Credenciales de acceso:');
    console.log('   Email: admin@jooru.com');
    console.log('   Contraseña: Admin123!');
    console.log('\n🔗 Panel de administración: http://localhost:3001');
    console.log('\n⚠️  IMPORTANTE: Cambia la contraseña después del primer acceso.');

  } catch (error) {
    console.error('❌ Error creando usuario administrador:', error.message);
    
    if (error.code === 11000) {
      console.log('\n💡 El email ya está registrado. Verifica si ya existe un usuario con ese email.');
    }
  } finally {
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('\n🔌 Conexión a la base de datos cerrada.');
    process.exit(0);
  }
}

// Ejecutar el script
if (require.main === module) {
  createAdminUser();
}

module.exports = createAdminUser;