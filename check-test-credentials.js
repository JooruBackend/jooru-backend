const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function checkTestCredentials() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB');

    // Verificar usuario cliente
    const clientUser = await User.findOne({ email: 'usuario@ejemplo.com' });
    console.log('\n=== USUARIO CLIENTE ===');
    if (clientUser) {
      console.log('Email:', clientUser.email);
      console.log('Rol:', clientUser.role);
      console.log('Activo:', clientUser.isActive);
      console.log('Verificado:', clientUser.isVerified);
      console.log('Hash de contraseña:', clientUser.password);
      
      // Verificar contraseña
      const isValidPassword = await bcrypt.compare('password123', clientUser.password);
      console.log('Contraseña "password123" es válida:', isValidPassword);
    } else {
      console.log('Usuario cliente no encontrado');
    }

    // Verificar usuario profesional
    const professionalUser = await User.findOne({ email: 'profesional@ejemplo.com' });
    console.log('\n=== USUARIO PROFESIONAL ===');
    if (professionalUser) {
      console.log('Email:', professionalUser.email);
      console.log('Rol:', professionalUser.role);
      console.log('Activo:', professionalUser.isActive);
      console.log('Verificado:', professionalUser.isVerified);
      console.log('Hash de contraseña:', professionalUser.password);
      
      // Verificar contraseña
      const isValidPassword = await bcrypt.compare('password123', professionalUser.password);
      console.log('Contraseña "password123" es válida:', isValidPassword);
    } else {
      console.log('Usuario profesional no encontrado');
    }

    // Buscar usuarios similares
    console.log('\n=== USUARIOS SIMILARES ===');
    const similarUsers = await User.find({
      $or: [
        { email: { $regex: 'usuario', $options: 'i' } },
        { email: { $regex: 'profesional', $options: 'i' } },
        { email: { $regex: 'ejemplo', $options: 'i' } }
      ]
    }).select('email role isActive isVerified');
    
    console.log('Usuarios encontrados con términos similares:');
    similarUsers.forEach(user => {
      console.log(`- ${user.email} (${user.role}) - Activo: ${user.isActive}, Verificado: ${user.isVerified}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkTestCredentials();