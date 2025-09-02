// Archivo específico para Vercel
const express = require('express');
const cors = require('cors');

// Crear aplicación Express
const app = express();

// Middlewares básicos
app.use(cors());
app.use(express.json());

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

// Exportar la aplicación para Vercel
module.exports = app;