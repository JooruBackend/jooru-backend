const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    
    const users = await User.find({}, 'email role profile.firstName profile.lastName isActive isVerified');
    
    console.log('\n📋 Usuarios en la base de datos:');
    if (users.length === 0) {
      console.log('   No hay usuarios registrados');
    } else {
      users.forEach(user => {
        const status = user.isActive ? '✅' : '❌';
        const verified = user.isVerified ? '✓' : '✗';
        console.log(`   ${status} ${user.email} (${user.role}) - ${user.profile.firstName} ${user.profile.lastName} [Verificado: ${verified}]`);
      });
    }
    
    await mongoose.connection.close();
    console.log('\n🔌 Conexión cerrada');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUsers();