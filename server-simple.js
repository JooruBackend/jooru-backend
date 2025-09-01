const express = require('express');
const cors = require('cors');

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware básico
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// Ruta de health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Servidor backend funcionando correctamente',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Ruta básica de API
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor backend iniciado exitosamente en puerto ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test API: http://localhost:${PORT}/api/test`);
});

module.exports = app;