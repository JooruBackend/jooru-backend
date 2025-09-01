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

const fixAdminPassword = async () => {
  try {
    await connectDB();
    
    const adminEmail = 'admin@jooru.com';
    const adminPassword = 'Admin123!';
    
    console.log('🔧 Reparando contraseña del administrador...');
    
    // Buscar el usuario administrador (incluir password)
    const admin = await User.findOne({ email: adminEmail }).select('+password');
    
    if (admin) {
      // Actualizar la contraseña (el middleware pre-save se encargará del hash)
      admin.password = adminPassword;
      await admin.save();
      
      console.log('✅ Contraseña del administrador actualizada exitosamente');
      console.log('');
      console.log('📋 Credenciales de acceso:');
      console.log(`   📧 Email: ${adminEmail}`);
      console.log(`   🔑 Contraseña: ${adminPassword}`);
      console.log('');
      
      // Verificar que la contraseña funciona
      const isValid = await bcrypt.compare(adminPassword, admin.password);
      console.log(`🔍 Verificación: ${isValid ? '✅ Contraseña válida' : '❌ Error en la contraseña'}`);
      
    } else {
      console.log('❌ Usuario administrador no encontrado');
      console.log('💡 Ejecuta el script seed-test-data.js primero');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexión cerrada');
  }
};

fixAdminPassword();