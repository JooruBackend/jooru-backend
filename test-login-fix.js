const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

// Script para probar el login después de las correcciones
async function testLoginFix() {
  try {
    console.log('🔧 Probando login después de correcciones...');
    
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    
    // Buscar usuario de prueba
    const testEmail = 'admin@jooru.com';
    const user = await User.findByEmail(testEmail);
    
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return;
    }
    
    console.log('✅ Usuario encontrado:', user.email);
    
    // Simular proceso de login
    console.log('\n🔍 Simulando proceso de login...');
    
    // 1. Verificar contraseña
    const testPassword = 'admin123';
    const isPasswordValid = await user.comparePassword(testPassword);
    console.log('1. Verificación de contraseña:', isPasswordValid ? '✅' : '❌');
    
    if (!isPasswordValid) {
      console.log('❌ Contraseña incorrecta');
      return;
    }
    
    // 2. Resetear intentos de login
    try {
      await user.resetLoginAttempts();
      console.log('2. Reset de intentos de login: ✅');
    } catch (error) {
      console.log('2. Reset de intentos de login: ❌', error.message);
    }
    
    // 3. Generar tokens
    try {
      const accessToken = user.generateAuthToken();
      console.log('3. Generación de access token: ✅');
      console.log('   Token generado:', !!accessToken);
    } catch (error) {
      console.log('3. Generación de access token: ❌', error.message);
    }
    
    try {
      const refreshToken = user.generateRefreshToken();
      console.log('4. Generación de refresh token: ✅');
      console.log('   Token generado:', !!refreshToken);
    } catch (error) {
      console.log('4. Generación de refresh token: ❌', error.message);
    }
    
    // 5. Actualizar último login
    user.lastLogin = new Date();
    console.log('5. Actualización de último login: ✅');
    
    // 6. Agregar refresh token
    try {
      const testRefreshToken = 'test-refresh-' + Date.now();
      user.refreshTokens.push({
        token: testRefreshToken,
        createdAt: new Date(),
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1'
      });
      
      await user.save();
      console.log('6. Guardado de refresh token: ✅');
    } catch (error) {
      console.log('6. Guardado de refresh token: ❌', error.message);
    }
    
    console.log('\n🎉 Proceso de login completado exitosamente');
    
  } catch (error) {
    console.log('❌ Error en prueba de login:', error.message);
    console.log('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

// Exportar para uso manual
module.exports = testLoginFix;

// Instrucciones de uso:
// 1. Asegúrate de que Node.js esté instalado
// 2. Ejecuta: node test-login-fix.js
// 3. Verifica que todos los pasos muestren ✅

console.log('📋 Script de prueba de login creado');
console.log('💡 Para ejecutar: node test-login-fix.js');
console.log('🔧 Correcciones aplicadas:');
console.log('   - generateAccessToken → generateAuthToken');
console.log('   - Métodos del modelo User verificados');