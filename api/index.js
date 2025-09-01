// Archivo específico para Vercel
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
require('dotenv').config();

// Importar modelos
const User = require('../models/User');
const Professional = require('../models/Professional');
const ServiceRequest = require('../models/ServiceRequest');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Invoice = require('../models/Invoice');
const PaymentMethod = require('../models/PaymentMethod');

// Importar utilidades
const { DatabaseUtils } = require('../utils/database');
const logger = require('../utils/logger-vercel');
const { errorHandler } = require('../utils/response');

// Importar middlewares
const responseMiddleware = require('../middleware/responseMiddleware');
const { optionalAuthenticate } = require('../middleware/authenticate');

// Importar rutas
const authRoutes = require('../routes/auth');
const userRoutes = require('../routes/users');
const professionalRoutes = require('../routes/professionals');
const serviceRoutes = require('../routes/services');
const quoteRoutes = require('../routes/quotes');
const paymentRoutes = require('../routes/payments');
const chatRoutes = require('../routes/chat');
const notificationRoutes = require('../routes/notifications');
const adminRoutes = require('../routes/admin');

// Crear aplicación Express
const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana de tiempo
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middlewares de seguridad
app.use(helmet());
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
app.use(compression());

// Middleware de logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de sanitización
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Middlewares personalizados
app.use(responseMiddleware);
app.use(optionalAuthenticate);

// Middleware de headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/professionals', professionalRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Endpoints de salud
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Backend funcionando correctamente',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Endpoint raíz
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Jooru Backend API',
    status: 'running',
    version: '1.0.0'
  });
});

// Middleware de manejo de errores 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    path: req.originalUrl
  });
});

// Middleware de manejo de errores
app.use(errorHandler);

// Inicializar base de datos
DatabaseUtils.connect().catch(err => {
  logger.error('Error connecting to database:', err);
});

// Exportar la aplicación para Vercel
module.exports = app;