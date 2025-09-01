// Script simple para probar conexión sin Node.js
// Este archivo puede ser revisado manualmente

const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

// Función para probar la conexión
async function testConnection() {
  try {
    console.log('Probando conexión a MongoDB...');
    console.log('URI:', process.env.MONGODB_URI);
    
    // Conectar
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    
    // Buscar usuario
    const user = await User.findOne({ email: 'admin@jooru.com' });
    console.log('Usuario encontrado:', !!user);
    
    if (user) {
      console.log('Métodos disponibles:');
      console.log('- comparePassword:', typeof user.comparePassword);
      console.log('- generateAuthToken:', typeof user.generateAuthToken);
      console.log('- resetLoginAttempts:', typeof user.resetLoginAttempts);
      console.log('- incLoginAttempts:', typeof user.incLoginAttempts);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

// Exportar para uso manual
module.exports = testConnection;

// Comentarios para diagnóstico manual:
// 1. Verificar que JWT_SECRET esté definido en .env
// 2. Verificar que MONGODB_URI sea válido
// 3. Verificar que el usuario admin@jooru.com exista
// 4. Verificar que los métodos del modelo estén correctamente definidos