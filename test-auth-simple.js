const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function testAuth() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Conectado a MongoDB');

    // Buscar un usuario existente
    console.log('\nBuscando usuarios existentes...');
    const users = await User.find({}).select('+password').limit(3);
    console.log(`Encontrados ${users.length} usuarios`);

    if (users.length === 0) {
      console.log('No hay usuarios en la base de datos');
      return;
    }

    // Probar login con el primer usuario
    const testUser = users[0];
    console.log(`\nProbando login con: ${testUser.email}`);
    console.log(`Tipo de usuario: ${testUser.userType}`);
    console.log(`Password hash existe: ${!!testUser.password}`);

    // Intentar comparar password con una contraseña común
    const commonPasswords = ['123456', 'Admin123!', 'password', 'test123'];
    
    for (const pwd of commonPasswords) {
      try {
        const isMatch = await testUser.comparePassword(pwd);
        if (isMatch) {
          console.log(`✓ Password encontrada: ${pwd}`);
          
          // Generar token
          const token = testUser.generateAuthToken();
          console.log(`✓ Token generado: ${token.substring(0, 20)}...`);
          break;
        }
      } catch (error) {
        console.log(`✗ Error comparando password '${pwd}': ${error.message}`);
      }
    }

    // Probar creación de nuevo usuario
    console.log('\n--- Probando creación de usuario ---');
    const testEmail = 'test-' + Date.now() + '@test.com';
    
    try {
      const newUser = new User({
        email: testEmail,
        password: 'TestPassword123!',
        userType: 'client',
        profile: {
          firstName: 'Test',
          lastName: 'User',
          phone: '+1234567890'
        }
      });

      await newUser.save();
      console.log(`✓ Usuario creado: ${testEmail}`);
      
      // Probar login inmediatamente
      const loginTest = await newUser.comparePassword('TestPassword123!');
      console.log(`✓ Login test: ${loginTest}`);
      
      // Limpiar
      await User.deleteOne({ email: testEmail });
      console.log('✓ Usuario de prueba eliminado');
      
    } catch (error) {
      console.log(`✗ Error creando usuario: ${error.message}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nConexión cerrada');
  }
}

testAuth();