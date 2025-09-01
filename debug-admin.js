const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

const debugAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    
    const adminEmail = 'admin@jooru.com';
    const adminPassword = 'Admin123!';
    
    // Buscar admin sin password
    console.log('\n1. Buscando admin sin password...');
    const adminWithoutPassword = await User.findOne({ email: adminEmail });
    console.log('Admin encontrado:', adminWithoutPassword ? 'Sí' : 'No');
    if (adminWithoutPassword) {
      console.log('Tiene password:', adminWithoutPassword.password ? 'Sí' : 'No');
    }
    
    // Buscar admin con password
    console.log('\n2. Buscando admin con password...');
    const adminWithPassword = await User.findOne({ email: adminEmail }).select('+password');
    console.log('Admin encontrado:', adminWithPassword ? 'Sí' : 'No');
    if (adminWithPassword) {
      console.log('Tiene password:', adminWithPassword.password ? 'Sí' : 'No');
      console.log('Password length:', adminWithPassword.password ? adminWithPassword.password.length : 0);
      console.log('Password starts with $2a:', adminWithPassword.password ? adminWithPassword.password.startsWith('$2a') : false);
    }
    
    // Crear nuevo hash
    console.log('\n3. Creando nuevo hash...');
    const newHash = await bcrypt.hash(adminPassword, 12);
    console.log('Nuevo hash creado:', newHash.length, 'caracteres');
    console.log('Nuevo hash:', newHash);
    
    // Verificar nuevo hash
    console.log('\n4. Verificando nuevo hash...');
    const isNewHashValid = await bcrypt.compare(adminPassword, newHash);
    console.log('Nuevo hash válido:', isNewHashValid);
    
    // Actualizar admin
    if (adminWithPassword) {
      console.log('\n5. Actualizando admin...');
      adminWithPassword.password = newHash;
      await adminWithPassword.save();
      console.log('Admin actualizado');
      
      // Verificar después de guardar
      console.log('\n6. Verificando después de guardar...');
      const updatedAdmin = await User.findOne({ email: adminEmail }).select('+password');
      if (updatedAdmin) {
        console.log('Password después de guardar:', updatedAdmin.password.length, 'caracteres');
        const isFinalValid = await bcrypt.compare(adminPassword, updatedAdmin.password);
        console.log('Password final válida:', isFinalValid);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Conexión cerrada');
  }
};

debugAdmin();