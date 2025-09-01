const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Importar modelos
require('./models/User');
const User = mongoose.model('User');

async function debugAdminLogin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB Atlas');

    const email = 'admin@proserv.com';
    const password = 'Admin123!';

    console.log('\n=== Debug del proceso de login ===');
    console.log('Email a buscar:', email);
    console.log('Email en minúsculas:', email.toLowerCase());
    
    // 1. Buscar usuario usando findByEmail
    console.log('\n1. Buscando usuario con findByEmail...');
    const userByEmail = await User.findByEmail(email);
    console.log('Usuario encontrado con findByEmail:', userByEmail ? 'SÍ' : 'NO');
    
    if (userByEmail) {
      console.log('- ID:', userByEmail._id);
      console.log('- Email:', userByEmail.email);
      console.log('- Role:', userByEmail.role);
      console.log('- IsActive:', userByEmail.isActive);
      console.log('- Password hash presente:', !!userByEmail.password);
      console.log('- Password hash length:', userByEmail.password ? userByEmail.password.length : 0);
    }
    
    // 2. Buscar usuario directamente
    console.log('\n2. Buscando usuario directamente...');
    const userDirect = await User.findOne({ email: email.toLowerCase() }).select('+password');
    console.log('Usuario encontrado directamente:', userDirect ? 'SÍ' : 'NO');
    
    // 3. Buscar todos los usuarios admin
    console.log('\n3. Buscando todos los usuarios admin...');
    const adminUsers = await User.find({ role: 'admin' }).select('+password');
    console.log('Usuarios admin encontrados:', adminUsers.length);
    
    adminUsers.forEach((admin, index) => {
      console.log(`\nAdmin ${index + 1}:`);
      console.log('- Email:', admin.email);
      console.log('- Email lowercase:', admin.email.toLowerCase());
      console.log('- Password hash:', admin.password ? admin.password.substring(0, 20) + '...' : 'NO');
    });
    
    // 4. Probar comparación de contraseña
    if (userByEmail && userByEmail.password) {
      console.log('\n4. Probando comparación de contraseña...');
      console.log('Password a comparar:', password);
      
      // Comparar usando el método del modelo
      const isValidMethod = await userByEmail.comparePassword(password);
      console.log('Resultado con método comparePassword:', isValidMethod);
      
      // Comparar directamente con bcrypt
      const isValidDirect = await bcrypt.compare(password, userByEmail.password);
      console.log('Resultado con bcrypt.compare directo:', isValidDirect);
      
      // Probar con diferentes variaciones de la contraseña
      const testPasswords = ['Admin123!', 'admin123!', 'ADMIN123!'];
      console.log('\nProbando variaciones de contraseña:');
      for (const testPass of testPasswords) {
        const result = await bcrypt.compare(testPass, userByEmail.password);
        console.log(`- '${testPass}': ${result}`);
      }
    }
    
    // 5. Crear un hash de prueba para verificar
    console.log('\n5. Creando hash de prueba...');
    const testHash = await bcrypt.hash(password, 12);
    console.log('Hash de prueba creado:', testHash.substring(0, 20) + '...');
    
    const testComparison = await bcrypt.compare(password, testHash);
    console.log('Comparación con hash de prueba:', testComparison);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

debugAdminLogin();