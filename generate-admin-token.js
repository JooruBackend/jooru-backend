const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const fs = require('fs');
require('dotenv').config();

// Importar el modelo de usuario
const User = require('./models/User');

async function generateAdminToken() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jooru');
    console.log('✅ Conectado a MongoDB');

    // Buscar un usuario admin
    const adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      console.log('❌ No se encontró ningún usuario admin');
      return;
    }

    console.log('✅ Usuario admin encontrado:', adminUser.email);

    // Generar token JWT
    const payload = {
      userId: adminUser._id,
      email: adminUser.email,
      role: adminUser.role
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Guardar token en archivo
    const tokenData = {
      token: token,
      user: {
        id: adminUser._id,
        email: adminUser.email,
        role: adminUser.role
      },
      generatedAt: new Date().toISOString(),
      expiresIn: '24h'
    };

    fs.writeFileSync('admin-token-debug.json', JSON.stringify(tokenData, null, 2));
    console.log('✅ Token de admin generado y guardado en admin-token-debug.json');
    console.log('🔑 Token válido por 24 horas');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

generateAdminToken();