const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Modelo de Usuario
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  status: String,
  isVerified: Boolean
});

const User = mongoose.model('User', userSchema);

async function getValidCredentials() {
  try {
    console.log('🔍 Conectando a la base de datos...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    console.log('\n📋 Obteniendo usuarios con contraseñas válidas...');
    
    // Obtener usuarios activos y verificados
    const users = await User.find({
      status: 'active',
      isVerified: true
    }).select('name email password role status isVerified').limit(10);

    console.log(`\n📊 Encontrados ${users.length} usuarios activos y verificados`);

    const testPasswords = ['password123', '123456', 'password', 'test123', 'admin123'];
    const validCredentials = [];

    for (const user of users) {
      console.log(`\n👤 Verificando usuario: ${user.email} (${user.role})`);
      
      for (const testPassword of testPasswords) {
        try {
          const isValid = await bcrypt.compare(testPassword, user.password);
          if (isValid) {
            console.log(`✅ Contraseña válida encontrada: ${testPassword}`);
            validCredentials.push({
              email: user.email,
              password: testPassword,
              name: user.name,
              role: user.role,
              status: user.status,
              isVerified: user.isVerified
            });
            break;
          }
        } catch (error) {
          console.log(`❌ Error verificando contraseña ${testPassword}:`, error.message);
        }
      }
    }

    console.log('\n🎯 CREDENCIALES VÁLIDAS ENCONTRADAS:');
    console.log('=' .repeat(50));
    
    const clients = validCredentials.filter(u => u.role === 'user' || u.role === 'client');
    const professionals = validCredentials.filter(u => u.role === 'professional');
    
    if (clients.length > 0) {
      console.log('\n👤 CLIENTES:');
      clients.forEach((client, index) => {
        console.log(`${index + 1}. Email: ${client.email}`);
        console.log(`   Contraseña: ${client.password}`);
        console.log(`   Nombre: ${client.name}`);
        console.log(`   Estado: ${client.status}`);
        console.log(`   Verificado: ${client.isVerified}`);
        console.log('');
      });
    } else {
      console.log('\n❌ No se encontraron clientes con contraseñas válidas');
    }

    if (professionals.length > 0) {
      console.log('\n👨‍💼 PROFESIONALES:');
      professionals.forEach((prof, index) => {
        console.log(`${index + 1}. Email: ${prof.email}`);
        console.log(`   Contraseña: ${prof.password}`);
        console.log(`   Nombre: ${prof.name}`);
        console.log(`   Estado: ${prof.status}`);
        console.log(`   Verificado: ${prof.isVerified}`);
        console.log('');
      });
    } else {
      console.log('\n❌ No se encontraron profesionales con contraseñas válidas');
    }

    if (validCredentials.length === 0) {
      console.log('\n⚠️  No se encontraron credenciales válidas con las contraseñas comunes.');
      console.log('Mostrando algunos usuarios para análisis manual:');
      
      const sampleUsers = await User.find({ status: 'active' }).select('name email role status isVerified').limit(5);
      sampleUsers.forEach(user => {
        console.log(`- ${user.email} (${user.role}) - Estado: ${user.status} - Verificado: ${user.isVerified}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

getValidCredentials();