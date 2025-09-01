const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function fixTestCredentials() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB');

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash('password123', 10);
    console.log('Contraseña hasheada:', hashedPassword);

    // Actualizar usuario cliente
    const clientUpdate = await User.updateOne(
      { email: 'usuario@ejemplo.com' },
      { 
        password: hashedPassword,
        isActive: true,
        isVerified: true
      }
    );
    console.log('\nActualización usuario cliente:', clientUpdate);

    // Actualizar usuario profesional
    const professionalUpdate = await User.updateOne(
      { email: 'profesional@ejemplo.com' },
      { 
        password: hashedPassword,
        isActive: true,
        isVerified: true
      }
    );
    console.log('Actualización usuario profesional:', professionalUpdate);

    // Verificar los cambios
    console.log('\n=== VERIFICACIÓN ===');
    const clientUser = await User.findOne({ email: 'usuario@ejemplo.com' }).select('+password');
    const professionalUser = await User.findOne({ email: 'profesional@ejemplo.com' }).select('+password');

    if (clientUser) {
      console.log('Cliente - Email:', clientUser.email, 'Rol:', clientUser.role);
      console.log('Cliente - Tiene contraseña:', !!clientUser.password);
      const isValidClient = await bcrypt.compare('password123', clientUser.password);
      console.log('Cliente - Contraseña válida:', isValidClient);
    }

    if (professionalUser) {
      console.log('Profesional - Email:', professionalUser.email, 'Rol:', professionalUser.role);
      console.log('Profesional - Tiene contraseña:', !!professionalUser.password);
      const isValidProfessional = await bcrypt.compare('password123', professionalUser.password);
      console.log('Profesional - Contraseña válida:', isValidProfessional);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixTestCredentials();