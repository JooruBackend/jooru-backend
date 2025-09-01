const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function debugLoginIssue() {
  try {
    console.log('🔍 Iniciando diagnóstico de problemas de login...');
    
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    
    // Buscar un usuario de prueba
    const testEmail = 'admin@jooru.com';
    console.log(`\n🔍 Buscando usuario: ${testEmail}`);
    
    const user = await User.findByEmail(testEmail);
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return;
    }
    
    console.log('✅ Usuario encontrado:');
    console.log('- ID:', user._id);
    console.log('- Email:', user.email);
    console.log('- Role:', user.role);
    console.log('- isActive:', user.isActive);
    console.log('- isVerified:', user.isVerified);
    console.log('- loginAttempts:', user.loginAttempts);
    console.log('- lockUntil:', user.lockUntil);
    console.log('- refreshTokens length:', user.refreshTokens ? user.refreshTokens.length : 'undefined');
    
    // Verificar métodos del usuario
    console.log('\n🔍 Verificando métodos del usuario:');
    console.log('- comparePassword:', typeof user.comparePassword);
    console.log('- generateAuthToken:', typeof user.generateAuthToken);
    console.log('- generateRefreshToken:', typeof user.generateRefreshToken);
    console.log('- incLoginAttempts:', typeof user.incLoginAttempts);
    console.log('- resetLoginAttempts:', typeof user.resetLoginAttempts);
    console.log('- addDeviceToken:', typeof user.addDeviceToken);
    console.log('- getPublicProfile:', typeof user.getPublicProfile);
    
    // Probar comparación de contraseña
    console.log('\n🔍 Probando comparación de contraseña...');
    const testPassword = 'admin123';
    
    try {
      const isValid = await user.comparePassword(testPassword);
      console.log(`✅ Contraseña '${testPassword}' es válida:`, isValid);
    } catch (error) {
      console.log('❌ Error en comparePassword:', error.message);
    }
    
    // Probar generación de tokens
    console.log('\n🔍 Probando generación de tokens...');
    
    try {
      const accessToken = user.generateAuthToken();
      console.log('✅ Access token generado:', !!accessToken);
    } catch (error) {
      console.log('❌ Error en generateAuthToken:', error.message);
    }
    
    try {
      const refreshToken = user.generateRefreshToken();
      console.log('✅ Refresh token generado:', !!refreshToken);
    } catch (error) {
      console.log('❌ Error en generateRefreshToken:', error.message);
    }
    
    // Probar reseteo de intentos
    console.log('\n🔍 Probando reseteo de intentos...');
    
    try {
      await user.resetLoginAttempts();
      console.log('✅ Intentos de login reseteados');
    } catch (error) {
      console.log('❌ Error en resetLoginAttempts:', error.message);
    }
    
    // Probar agregar refresh token
    console.log('\n🔍 Probando agregar refresh token...');
    
    try {
      const testRefreshToken = 'test-refresh-token-' + Date.now();
      user.refreshTokens.push({
        token: testRefreshToken,
        createdAt: new Date(),
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1'
      });
      
      await user.save();
      console.log('✅ Refresh token agregado y usuario guardado');
    } catch (error) {
      console.log('❌ Error agregando refresh token:', error.message);
      console.log('Stack:', error.stack);
    }
    
    // Verificar variables de entorno
    console.log('\n🔍 Verificando variables de entorno:');
    console.log('- JWT_SECRET:', process.env.JWT_SECRET ? '✅ Definido' : '❌ No definido');
    console.log('- JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET ? '✅ Definido' : '❌ No definido');
    console.log('- JWT_EXPIRE:', process.env.JWT_EXPIRE || 'No definido (usando default)');
    console.log('- JWT_REFRESH_EXPIRE:', process.env.JWT_REFRESH_EXPIRE || 'No definido (usando default)');
    
  } catch (error) {
    console.log('❌ Error en diagnóstico:', error.message);
    console.log('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

// Ejecutar diagnóstico
debugLoginIssue().catch(console.error);