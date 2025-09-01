const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
};

const fixAllPasswords = async () => {
  try {
    await connectDB();
    
    console.log('🔧 Reparando contraseñas de todos los usuarios...');
    
    // Definir las contraseñas correctas
    const passwordMap = {
      'admin@jooru.com': 'Admin123!',
      'juan.perez@test.com': 'Test123!',
      'maria.garcia@test.com': 'Test123!',
      'carlos.lopez@test.com': 'Test123!',
      'ana.martinez@professional.com': 'Prof123!',
      'luis.rodriguez@professional.com': 'Prof123!',
      'sofia.hernandez@professional.com': 'Prof123!',
      'miguel.torres@professional.com': 'Prof123!',
      'laura.sanchez@professional.com': 'Prof123!'
    };
    
    let fixed = 0;
    let notFound = 0;
    
    for (const [email, password] of Object.entries(passwordMap)) {
      try {
        const user = await User.findOne({ email }).select('+password');
        
        if (user) {
          // Actualizar la contraseña (el middleware pre-save se encargará del hash)
          user.password = password;
          await user.save();
          
          console.log(`✅ ${email} - Contraseña actualizada`);
          fixed++;
        } else {
          console.log(`❌ ${email} - Usuario no encontrado`);
          notFound++;
        }
      } catch (error) {
        console.log(`❌ ${email} - Error: ${error.message}`);
      }
    }
    
    console.log('');
    console.log('📊 Resumen:');
    console.log(`   ✅ Contraseñas reparadas: ${fixed}`);
    console.log(`   ❌ Usuarios no encontrados: ${notFound}`);
    console.log('');
    console.log('🎉 ¡Todas las contraseñas han sido reparadas!');
    console.log('');
    console.log('📋 Credenciales de acceso:');
    console.log('   👤 Admin: admin@jooru.com / Admin123!');
    console.log('   👤 Cliente: juan.perez@test.com / Test123!');
    console.log('   👤 Profesional: ana.martinez@professional.com / Prof123!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexión cerrada');
  }
};

fixAllPasswords();