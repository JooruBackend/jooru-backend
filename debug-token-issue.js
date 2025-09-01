const jwt = require('jsonwebtoken');
const User = require('./models/User');
const mongoose = require('mongoose');
require('dotenv').config();

async function debugTokenIssue() {
  try {
    console.log('🔍 Depurando problema de token...');
    
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    
    // Buscar el usuario admin
    const user = await User.findOne({ email: 'admin@jooru.com' });
    if (!user) {
      console.log('❌ Usuario admin no encontrado');
      return;
    }
    
    console.log('✅ Usuario encontrado:', user.email);
    console.log('User ID:', user._id);
    console.log('Role:', user.role);
    
    // Generar token usando el método del modelo
    console.log('\n🔑 Generando token...');
    const token = user.generateAuthToken();
    console.log('Token generado:', token);
    
    // Verificar inmediatamente el token
    console.log('\n🔍 Verificando token inmediatamente...');
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token válido');
      console.log('Decoded payload:', decoded);
      
      // Verificar que el usuario existe con el ID del token
      const userFromToken = await User.findById(decoded.userId).select('-password');
      if (userFromToken) {
        console.log('✅ Usuario encontrado con ID del token');
        console.log('Usuario del token:', userFromToken.email);
      } else {
        console.log('❌ Usuario NO encontrado con ID del token');
      }
      
    } catch (verifyError) {
      console.log('❌ Error verificando token:', verifyError.message);
      console.log('Error name:', verifyError.name);
    }
    
    // Verificar variables de entorno
    console.log('\n🔍 Verificando configuración...');
    console.log('JWT_SECRET definido:', !!process.env.JWT_SECRET);
    console.log('JWT_SECRET length:', process.env.JWT_SECRET?.length);
    console.log('JWT_EXPIRE:', process.env.JWT_EXPIRE);
    
    // Probar manualmente la verificación como lo hace el middleware
    console.log('\n🔍 Simulando middleware de autenticación...');
    try {
      const authHeader = `Bearer ${token}`;
      const extractedToken = authHeader.substring(7);
      console.log('Token extraído del header:', extractedToken === token ? 'IGUAL' : 'DIFERENTE');
      
      const decoded = jwt.verify(extractedToken, process.env.JWT_SECRET);
      console.log('✅ Middleware simulation: Token válido');
      
      const userFromMiddleware = await User.findById(decoded.userId)
        .select('-password')
        .populate('professional', 'businessName services isVerified');
        
      if (userFromMiddleware) {
        console.log('✅ Usuario encontrado en simulación de middleware');
        console.log('isActive:', userFromMiddleware.isActive);
        console.log('isVerified:', userFromMiddleware.isVerified);
        console.log('role:', userFromMiddleware.role);
      } else {
        console.log('❌ Usuario NO encontrado en simulación de middleware');
      }
      
    } catch (middlewareError) {
      console.log('❌ Error en simulación de middleware:', middlewareError.message);
      console.log('Error name:', middlewareError.name);
      console.log('Error stack:', middlewareError.stack);
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

debugTokenIssue();