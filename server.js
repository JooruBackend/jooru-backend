const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Importar modelos para asegurar que se registren
const User = require('./models/User');
const Professional = require('./models/Professional');
const ServiceRequest = require('./models/ServiceRequest');
const Payment = require('./models/Payment');
const Review = require('./models/Review');
const Notification = require('./models/Notification');
const Chat = require('./models/Chat');
const Message = require('./models/Message');
const Invoice = require('./models/Invoice');
const PaymentMethod = require('./models/PaymentMethod');

// Importar utilidades
const { DatabaseUtils } = require('./utils/database');
// Usar logger simplificado en Vercel/producción
const logger = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' 
  ? require('./utils/logger-vercel') 
  : require('./utils/logger');
const { errorHandler } = require('./utils/response');

// Importar middlewares
const responseMiddleware = require('./middleware/responseMiddleware');
const { optionalAuthenticate } = require('./middleware/authenticate');

// Importar rutas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const professionalRoutes = require('./routes/professionals');
const serviceRoutes = require('./routes/services');
const quoteRoutes = require('./routes/quotes');
const paymentRoutes = require('./routes/payments');
// const chatRoutes = require('./routes/chat');
// const reviewRoutes = require('./routes/reviews');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

// Importar servicios
const ChatService = require('./services/ChatService');

// Crear aplicación Express
const app = express();

// Configuración de Socket.IO
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000", 
      "http://localhost:3002",
      "https://jooru.com",
      "https://www.jooru.com",
      "https://jooru-admin.vercel.app",
      "https://jooru-web.vercel.app"
    ],
    methods: ["GET", "POST"]
  }
});

// Configuración de rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana de tiempo
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware de seguridad
// app.use(helmet({
//   crossOriginResourcePolicy: { policy: "cross-origin" }
// }));
app.use(cors({
  origin: [
    "http://localhost:3000", 
    "http://localhost:3002",
    "https://jooru.com",
    "https://www.jooru.com",
    "https://jooru-admin.vercel.app",
    "https://jooru-web.vercel.app"
  ],
  credentials: true
}));
// app.use(limiter);
app.use(compression());

// Middleware de logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
} else {
  app.use(morgan('dev'));
}

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de sanitización
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Middleware de respuesta estandarizada
app.use(responseMiddleware);

// Middleware de autenticación opcional para todas las rutas
app.use(optionalAuthenticate);

// Middleware para Socket.IO
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/professionals', professionalRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/payments', paymentRoutes);
// app.use('/api/chat', chatRoutes);
// app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Ruta de health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ruta de health check para API
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ruta simple de prueba
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Jooru Backend API',
    status: 'running',
    version: '1.0.0'
  });
});

// Documentación de la API con Swagger
// if (process.env.NODE_ENV !== 'production') {
//   const swaggerUi = require('swagger-ui-express');
//   const swaggerDocument = require('./docs/swagger.json');
//   
//   app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// }

// Middleware de manejo de errores
app.use(errorHandler);

// Inicializar ChatService con Socket.IO
ChatService.initialize(server);

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', {
    error: err.message,
    stack: err.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Rejection:', {
    error: err.message,
    stack: err.stack,
    promise
  });
  process.exit(1);
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;

// Función para iniciar el servidor
async function startServer() {
  try {
    // Conectar a la base de datos
    await DatabaseUtils.connect();
    logger.info('Conexión a MongoDB establecida exitosamente');

    // Crear índices necesarios
    await DatabaseUtils.createIndexes();
    logger.info('Índices de base de datos creados exitosamente');

    // Iniciar servidor
    const serverInstance = server.listen(PORT, () => {
      logger.info(`Servidor iniciado en puerto ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        timestamp: new Date().toISOString(),
        chatService: ChatService.isAvailable() ? 'enabled' : 'disabled'
      });
    });

    // Configurar timeout del servidor
    serverInstance.timeout = 30000; // 30 segundos

    return serverInstance;

  } catch (error) {
    logger.error('Error iniciando servidor:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Manejo graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Recibida señal ${signal}. Cerrando servidor...`);
  
  server.close(async () => {
    logger.info('Servidor HTTP cerrado');
    
    try {
      await DatabaseUtils.disconnect();
      logger.info('Conexión a MongoDB cerrada');
      process.exit(0);
    } catch (error) {
      logger.error('Error cerrando conexión a MongoDB:', {
        error: error.message
      });
      process.exit(1);
    }
  });

  // Forzar cierre después de 10 segundos
  setTimeout(() => {
    logger.error('Forzando cierre del servidor');
    process.exit(1);
  }, 10000);
};

// Escuchar señales de terminación
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Iniciar la aplicación
if (require.main === module) {
  startServer();
}

// Para Vercel, exportar la app directamente
if (process.env.VERCEL === '1') {
  module.exports = app;
} else {
  module.exports = { app, server, io };
}