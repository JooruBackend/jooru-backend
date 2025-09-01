const mongoose = require('mongoose');
require('dotenv').config();

// Importar modelos
require('./models/User');
const User = mongoose.model('User');

async function checkAdminUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB Atlas');

    // Buscar usuarios admin
    const adminUsers = await User.find({ role: 'admin' }).lean();
    console.log(`\nUsuarios admin encontrados: ${adminUsers.length}`);
    
    adminUsers.forEach((admin, index) => {
      console.log(`\nAdmin ${index + 1}:`);
      console.log('- Email:', admin.email);
      console.log('- Role:', admin.role);
      console.log('- IsActive:', admin.isActive);
      console.log('- IsVerified:', admin.isVerified);
      console.log('- Profile:', admin.profile);
    });

    // También buscar todos los usuarios para ver qué hay
    const allUsers = await User.find({}).select('email role isActive isVerified').lean();
    console.log(`\nTodos los usuarios (${allUsers.length}):`);
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} - ${user.role} - Active: ${user.isActive} - Verified: ${user.isVerified}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkAdminUsers();