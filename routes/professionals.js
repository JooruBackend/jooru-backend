const express = require('express');
const multer = require('multer');
const ProfessionalController = require('../controllers/professionalController');
const { authenticate, authorize, requireCompleteProfessionalProfile } = require('../utils/auth');
const { responseMiddleware } = require('../utils/response');
const { storageService } = require('../utils/storage');

const router = express.Router();

// Aplicar middleware de respuesta
router.use(responseMiddleware);

// Configurar multer para documentos de verificación
const uploadDocuments = storageService.configureMulter({
  fileFilter: (req, file, cb) => {
    // Permitir imágenes y PDFs
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen (JPEG, PNG) o PDF'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5 // máximo 5 archivos
  }
});

/**
 * @route   GET /api/professionals/search
 * @desc    Buscar profesionales
 * @access  Public
 */
router.get('/search', ProfessionalController.searchProfessionals);

/**
 * @route   GET /api/professionals/:professionalId
 * @desc    Obtener perfil profesional por ID
 * @access  Public
 */
router.get('/:professionalId', ProfessionalController.getProfessionalProfile);

/**
 * @route   PUT /api/professionals/profile
 * @desc    Crear o actualizar perfil profesional
 * @access  Private (solo profesionales)
 */
router.put('/profile', 
  authenticate, 
  authorize(['professional']), 
  ProfessionalController.updateProfessionalProfile
);

/**
 * @route   POST /api/professionals/services
 * @desc    Agregar servicio
 * @access  Private (solo profesionales)
 */
router.post('/services', 
  authenticate, 
  authorize(['professional']), 
  ProfessionalController.addService
);

/**
 * @route   PUT /api/professionals/services/:serviceId
 * @desc    Actualizar servicio
 * @access  Private (solo profesionales)
 */
router.put('/services/:serviceId', 
  authenticate, 
  authorize(['professional']), 
  ProfessionalController.updateService
);

/**
 * @route   DELETE /api/professionals/services/:serviceId
 * @desc    Eliminar servicio
 * @access  Private (solo profesionales)
 */
router.delete('/services/:serviceId', 
  authenticate, 
  authorize(['professional']), 
  ProfessionalController.deleteService
);

/**
 * @route   PUT /api/professionals/availability
 * @desc    Actualizar disponibilidad
 * @access  Private (solo profesionales)
 */
router.put('/availability', 
  authenticate, 
  authorize(['professional']), 
  ProfessionalController.updateAvailability
);

/**
 * @route   GET /api/professionals/service-requests
 * @desc    Obtener solicitudes de servicio del profesional
 * @access  Private (solo profesionales)
 */
router.get('/service-requests', 
  authenticate, 
  authorize(['professional']), 
  ProfessionalController.getServiceRequests
);

/**
 * @route   POST /api/professionals/service-requests/:serviceRequestId/quote
 * @desc    Enviar cotización
 * @access  Private (solo profesionales)
 */
router.post('/service-requests/:serviceRequestId/quote', 
  authenticate, 
  authorize(['professional']), 
  ProfessionalController.sendQuote
);

/**
 * @route   POST /api/professionals/verification/documents
 * @desc    Subir documentos de verificación
 * @access  Private (solo profesionales)
 */
router.post('/verification/documents', 
  authenticate, 
  authorize(['professional']), 
  uploadDocuments.array('documents', 5),
  ProfessionalController.uploadVerificationDocuments
);

/**
 * @route   GET /api/professionals/stats
 * @desc    Obtener estadísticas del profesional
 * @access  Private (solo profesionales)
 */
router.get('/stats', 
  authenticate, 
  authorize(['professional']), 
  ProfessionalController.getProfessionalStats
);

module.exports = router;