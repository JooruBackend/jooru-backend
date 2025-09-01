const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Modelo de Usuario
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  status: String,
  isVerified: Boolean
});

const User = mongoose.model('User', userSchema);

async function checkAllUsersStatus() {
  try {
    console.log('🔍 Conectando a la base de datos...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    console.log('\n📋 Analizando TODOS los usuarios en la base de datos...');
    
    // Obtener estadísticas generales
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const activeAndVerified = await User.countDocuments({ status: 'active', isVerified: true });
    
    console.log(`\n📊 ESTADÍSTICAS GENERALES:`);
    console.log(`Total de usuarios: ${totalUsers}`);
    console.log(`Usuarios activos: ${activeUsers}`);
    console.log(`Usuarios verificados: ${verifiedUsers}`);
    console.log(`Usuarios activos Y verificados: ${activeAndVerified}`);

    // Obtener distribución por estado
    const statusDistribution = await User.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n📈 DISTRIBUCIÓN POR ESTADO:');
    statusDistribution.forEach(item => {
      console.log(`${item._id || 'undefined'}: ${item.count}`);
    });

    // Obtener distribución por verificación
    const verificationDistribution = await User.aggregate([
      { $group: { _id: '$isVerified', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n✅ DISTRIBUCIÓN POR VERIFICACIÓN:');
    verificationDistribution.forEach(item => {
      console.log(`${item._id === true ? 'Verificados' : item._id === false ? 'No verificados' : 'undefined'}: ${item.count}`);
    });

    // Obtener algunos usuarios de muestra para análisis
    console.log('\n👥 MUESTRA DE USUARIOS (primeros 10):');
    const sampleUsers = await User.find({}).select('name email role status isVerified').limit(10);
    
    sampleUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   Nombre: ${user.name || 'N/A'}`);
      console.log(`   Rol: ${user.role || 'N/A'}`);
      console.log(`   Estado: ${user.status || 'N/A'}`);
      console.log(`   Verificado: ${user.isVerified}`);
      console.log('');
    });

    // Intentar encontrar credenciales válidas sin filtros de estado
    console.log('\n🔐 PROBANDO CONTRASEÑAS EN USUARIOS SIN FILTROS:');
    const testPasswords = ['password123', '123456', 'password', 'test123', 'admin123', 'jooru123'];
    const validCredentials = [];

    const usersToTest = await User.find({}).select('name email password role status isVerified').limit(15);
    
    for (const user of usersToTest) {
      console.log(`\n🧪 Probando usuario: ${user.email} (${user.role || 'N/A'})`);
      console.log(`   Estado: ${user.status || 'N/A'} | Verificado: ${user.isVerified}`);
      
      for (const testPassword of testPasswords) {
        try {
          if (user.password) {
            const isValid = await bcrypt.compare(testPassword, user.password);
            if (isValid) {
              console.log(`   ✅ Contraseña válida: ${testPassword}`);
              validCredentials.push({
                email: user.email,
                password: testPassword,
                name: user.name,
                role: user.role,
                status: user.status,
                isVerified: user.isVerified
              });
              break;
            }
          }
        } catch (error) {
          console.log(`   ❌ Error con contraseña ${testPassword}:`, error.message);
        }
      }
    }

    console.log('\n🎯 CREDENCIALES VÁLIDAS ENCONTRADAS:');
    console.log('=' .repeat(60));
    
    if (validCredentials.length > 0) {
      validCredentials.forEach((cred, index) => {
        console.log(`\n${index + 1}. 📧 Email: ${cred.email}`);
        console.log(`   🔑 Contraseña: ${cred.password}`);
        console.log(`   👤 Nombre: ${cred.name || 'N/A'}`);
        console.log(`   🏷️  Rol: ${cred.role || 'N/A'}`);
        console.log(`   📊 Estado: ${cred.status || 'N/A'}`);
        console.log(`   ✅ Verificado: ${cred.isVerified}`);
      });
      
      // Separar por roles
      const clients = validCredentials.filter(u => u.role === 'user' || u.role === 'client');
      const professionals = validCredentials.filter(u => u.role === 'professional');
      
      console.log('\n🎯 RESUMEN PARA LOGIN:');
      if (clients.length > 0) {
        console.log(`\n👤 CLIENTE RECOMENDADO:`);
        console.log(`Email: ${clients[0].email}`);
        console.log(`Contraseña: ${clients[0].password}`);
      }
      
      if (professionals.length > 0) {
        console.log(`\n👨‍💼 PROFESIONAL RECOMENDADO:`);
        console.log(`Email: ${professionals[0].email}`);
        console.log(`Contraseña: ${professionals[0].password}`);
      }
    } else {
      console.log('\n❌ No se encontraron credenciales válidas');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

checkAllUsersStatus();