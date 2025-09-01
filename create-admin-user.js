const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Importar modelos
require('./models/User');
const User = mongoose.model('User');

async function createAdminUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB Atlas');

    // Verificar si ya existe un admin
    const existingAdmin = await User.findOne({ email: 'admin@proserv.com' });
    if (existingAdmin) {
      console.log('El usuario admin ya existe');
      console.log('Email:', existingAdmin.email);
      console.log('Role:', existingAdmin.role);
      console.log('IsActive:', existingAdmin.isActive);
      console.log('IsVerified:', existingAdmin.isVerified);
      return;
    }

    // Crear hash de la contraseña
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('Admin123!', saltRounds);

    // Crear usuario admin
    const adminUser = new User({
      email: 'admin@proserv.com',
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      isVerified: true,
      profile: {
        firstName: 'Admin',
        lastName: 'ProServ',
        phone: '+1234567890'
      }
    });

    await adminUser.save();
    console.log('✓ Usuario admin creado exitosamente');
    console.log('Email: admin@proserv.com');
    console.log('Password: Admin123!');
    console.log('Role: admin');

  } catch (error) {
    console.error('Error creando usuario admin:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createAdminUser();