const mongoose = require('mongoose');
require('dotenv').config();

async function verifyAtlasConnection() {
  try {
    console.log('🔍 Verificando configuración de MongoDB Atlas...');
    
    // Verificar que la URI sea de Atlas
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('❌ MONGODB_URI no está configurado en .env');
    }
    
    if (mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
      throw new Error('❌ Detectada configuración de base de datos local. Solo se debe usar MongoDB Atlas.');
    }
    
    if (!mongoUri.includes('mongodb+srv://')) {
      throw new Error('❌ La URI no es de MongoDB Atlas. Debe comenzar con mongodb+srv://');
    }
    
    console.log('✅ URI de MongoDB Atlas configurada correctamente');
    console.log('🔗 Conectando a:', mongoUri.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'));
    
    // Intentar conexión
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection;
    console.log('✅ Conexión exitosa a MongoDB Atlas');
    console.log('📊 Información de la base de datos:');
    console.log('   - Nombre:', db.name);
    console.log('   - Host:', db.host);
    console.log('   - Estado:', db.readyState === 1 ? 'Conectado' : 'Desconectado');
    
    // Verificar que estamos en Atlas
    if (!db.host.includes('mongodb.net')) {
      console.warn('⚠️  Advertencia: El host no parece ser de MongoDB Atlas');
    } else {
      console.log('✅ Confirmado: Conectado a MongoDB Atlas');
    }
    
    // Obtener estadísticas básicas
    const collections = await db.db.listCollections().toArray();
    console.log('📁 Colecciones disponibles:', collections.length);
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
    await mongoose.disconnect();
    console.log('\n🎉 Verificación completada: Solo MongoDB Atlas está configurado');
    
  } catch (error) {
    console.error('❌ Error en la verificación:', error.message);
    process.exit(1);
  }
}

verifyAtlasConnection();