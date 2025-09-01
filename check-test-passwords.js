const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
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

const checkTestPasswords = async () => {
  try {
    await connectDB();
    
    const testUsers = [
      { email: 'admin@jooru.com', password: 'Admin123!' },
      { email: 'juan.perez@test.com', password: 'Test123!' },
      { email: 'maria.garcia@test.com', password: 'Test123!' },
      { email: 'carlos.lopez@test.com', password: 'Test123!' }
    ];
    
    console.log('🔍 Verificando contraseñas de usuarios de prueba:\n');
    
    for (const testUser of testUsers) {
      const user = await User.findOne({ email: testUser.email });
      
      if (user) {
        console.log(`📧 ${testUser.email}:`);
        console.log(`   🔑 Contraseña esperada: ${testUser.password}`);
        console.log(`   👤 Nombre: ${user.profile?.firstName} ${user.profile?.lastName}`);
        
        if (user.password) {
          const isValid = await bcrypt.compare(testUser.password, user.password);
          console.log(`   ✅ Válida: ${isValid ? '✓' : '✗'}`);
          console.log(`   🔐 Hash: ${user.password.substring(0, 20)}...`);
        } else {
          console.log(`   ❌ Sin contraseña en la base de datos`);
        }
        console.log('');
      } else {
        console.log(`❌ Usuario no encontrado: ${testUser.email}\n`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexión cerrada');
  }
};

checkTestPasswords();