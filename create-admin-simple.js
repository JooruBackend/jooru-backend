const bcrypt = require('bcryptjs');
require('dotenv').config();

/**
 * Script simple para mostrar las credenciales de administrador
 * No requiere conexión a base de datos
 */

async function showAdminCredentials() {
  try {
    console.log('\n🎉 Credenciales de Administrador para Jooru');
    console.log('=' .repeat(50));
    console.log('\n📋 Credenciales de acceso:');
    console.log('   Email: admin@jooru.com');
    console.log('   Contraseña: Admin123!');
    console.log('\n🔗 Panel de administración: http://localhost:3001');
    console.log('\n📝 Instrucciones:');
    console.log('   1. Asegúrate de que el backend esté ejecutándose');
    console.log('   2. Ve al panel de administración en http://localhost:3001');
    console.log('   3. Usa las credenciales mostradas arriba');
    console.log('   4. Si no funciona, ejecuta el script completo cuando MongoDB esté disponible');
    console.log('\n⚠️  IMPORTANTE:');
    console.log('   - Estas credenciales deben crearse en la base de datos');
    console.log('   - Si MongoDB no está disponible, instálalo primero');
    console.log('   - Cambia la contraseña después del primer acceso');
    
    // Generar hash de la contraseña para referencia
    const hashedPassword = await bcrypt.hash('Admin123!', 12);
    console.log('\n🔐 Hash de contraseña (para referencia técnica):');
    console.log(`   ${hashedPassword}`);
    
    console.log('\n💡 Para instalar MongoDB:');
    console.log('   - Descarga MongoDB Community Edition desde mongodb.com');
    console.log('   - O usa MongoDB Atlas (cloud) y actualiza MONGODB_URI en .env');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar el script
if (require.main === module) {
  showAdminCredentials();
}

module.exports = showAdminCredentials;