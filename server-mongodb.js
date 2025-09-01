const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware básico
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3002", "http://localhost:3001"],
  credentials: true
}));
app.use(express.json());

// Conectar a MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
    console.log(`📊 Base de datos: ${conn.connection.name}`);
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    process.exit(1);
  }
};

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Servidor backend de Jooru funcionando correctamente',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      test: '/api/test',
      dbStatus: '/api/db-status'
    },
    timestamp: new Date().toISOString()
  });
});

// Ruta de health check
app.get('/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado';
  res.status(200).json({
    status: 'OK',
    message: 'Servidor backend funcionando correctamente',
    database: {
      status: dbStatus,
      name: mongoose.connection.name || 'N/A',
      host: mongoose.connection.host || 'N/A'
    },
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Ruta básica de API
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API funcionando correctamente',
    database: {
      status: mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado',
      name: mongoose.connection.name || 'N/A'
    },
    timestamp: new Date().toISOString()
  });
});

// Ruta para verificar conexión a base de datos
app.get('/api/db-status', async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    res.json({
      success: true,
      database: {
        status: 'Conectado',
        name: mongoose.connection.name,
        host: mongoose.connection.host,
        collections: collections.map(col => col.name)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verificando base de datos',
      error: error.message
    });
  }
});

// Importar y usar rutas de la API
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const professionalRoutes = require('./routes/professionals');
const serviceRoutes = require('./routes/services');
const quoteRoutes = require('./routes/quotes');
const paymentRoutes = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');
const chatRoutes = require('./routes/chat');

// Registrar rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/professionals', professionalRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);

console.log('📋 Rutas de API registradas:');
console.log('   - /api/auth (autenticación)');
console.log('   - /api/users (usuarios)');
console.log('   - /api/professionals (profesionales)');
console.log('   - /api/services (servicios)');
console.log('   - /api/quotes (cotizaciones)');
console.log('   - /api/payments (pagos)');
console.log('   - /api/notifications (notificaciones)');
console.log('   - /api/chat (chat)');

// Iniciar servidor
const startServer = async () => {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`✅ Servidor backend iniciado exitosamente en puerto ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`🔍 Health check: http://localhost:${PORT}/health`);
    console.log(`🧪 Test API: http://localhost:${PORT}/api/test`);
    console.log(`📊 DB Status: http://localhost:${PORT}/api/db-status`);
  });
};

startServer().catch(console.error);

module.exports = app;