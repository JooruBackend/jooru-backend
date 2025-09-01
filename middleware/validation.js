/**
 * Middleware de validación para requests
 * Proporciona funciones para validar datos de entrada
 */

const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Middleware para validar el resultado de express-validator
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        logger.warn('Validation errors:', {
            errors: errors.array(),
            path: req.path,
            method: req.method,
            ip: req.ip
        });
        
        return res.status(400).json({
            success: false,
            message: 'Datos de entrada inválidos',
            errors: errors.array()
        });
    }
    
    next();
};

/**
 * Middleware para sanitizar datos de entrada
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const sanitizeInput = (req, res, next) => {
    // Sanitizar query parameters
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = req.query[key].trim();
            }
        });
    }
    
    // Sanitizar body parameters
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key].trim();
            }
        });
    }
    
    next();
};

module.exports = {
    validateRequest,
    sanitizeInput
};