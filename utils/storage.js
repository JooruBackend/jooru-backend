const cloudinary = require('cloudinary').v2;
const AWS = require('aws-sdk');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');

/**
 * Servicio de almacenamiento unificado
 */
class StorageService {
  constructor() {
    this.cloudinaryConfigured = false;
    this.s3Configured = false;
    this.s3Client = null;
    
    this.initializeProviders();
  }

  /**
   * Inicializar proveedores de almacenamiento
   */
  initializeProviders() {
    try {
      // Configurar Cloudinary
      if (process.env.CLOUDINARY_CLOUD_NAME && 
          process.env.CLOUDINARY_API_KEY && 
          process.env.CLOUDINARY_API_SECRET) {
        
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
          secure: true
        });
        
        this.cloudinaryConfigured = true;
        logger.info('Cloudinary configurado correctamente');
      }

      // Configurar AWS S3
      if (process.env.AWS_ACCESS_KEY_ID && 
          process.env.AWS_SECRET_ACCESS_KEY && 
          process.env.AWS_REGION) {
        
        AWS.config.update({
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION
        });
        
        this.s3Client = new AWS.S3();
        this.s3Configured = true;
        logger.info('AWS S3 configurado correctamente');
      }
      
    } catch (error) {
      logger.error('Error inicializando proveedores de almacenamiento', {
        error: error.message
      });
    }
  }

  /**
   * Configurar multer para subida de archivos
   * @param {Object} options - Opciones de configuración
   * @returns {Object} Middleware de multer
   */
  configureMulter(options = {}) {
    const {
      destination = './uploads/temp',
      fileSize = 10 * 1024 * 1024, // 10MB por defecto
      allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
        'video/mp4',
        'video/quicktime'
      ]
    } = options;

    // Crear directorio si no existe
    this.ensureDirectoryExists(destination);

    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, destination);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
      }
    });

    const fileFilter = (req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize,
        files: 10 // Máximo 10 archivos por request
      }
    });
  }

  /**
   * Asegurar que un directorio existe
   * @param {string} dirPath - Ruta del directorio
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Subir imagen a Cloudinary
   * @param {string} filePath - Ruta del archivo local
   * @param {Object} options - Opciones de subida
   * @returns {Object} Resultado de la subida
   */
  async uploadToCloudinary(filePath, options = {}) {
    try {
      if (!this.cloudinaryConfigured) {
        throw new Error('Cloudinary no está configurado');
      }

      const {
        folder = 'proserv',
        transformation = {},
        resourceType = 'auto',
        publicId,
        tags = [],
        context = {}
      } = options;

      const uploadOptions = {
        folder,
        resource_type: resourceType,
        transformation,
        tags: ['proserv', ...tags],
        context,
        use_filename: true,
        unique_filename: true,
        overwrite: false
      };

      if (publicId) {
        uploadOptions.public_id = publicId;
      }

      const result = await cloudinary.uploader.upload(filePath, uploadOptions);

      // Eliminar archivo temporal
      await this.deleteLocalFile(filePath);

      logger.info('Archivo subido a Cloudinary', {
        publicId: result.public_id,
        url: result.secure_url,
        resourceType: result.resource_type,
        format: result.format,
        bytes: result.bytes
      });

      return {
        success: true,
        file: {
          publicId: result.public_id,
          url: result.secure_url,
          secureUrl: result.secure_url,
          format: result.format,
          resourceType: result.resource_type,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          createdAt: result.created_at,
          folder: result.folder,
          tags: result.tags
        }
      };
      
    } catch (error) {
      logger.error('Error subiendo a Cloudinary', {
        filePath,
        error: error.message
      });
      
      // Intentar eliminar archivo temporal en caso de error
      await this.deleteLocalFile(filePath).catch(() => {});
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Subir archivo a AWS S3
   * @param {string} filePath - Ruta del archivo local
   * @param {Object} options - Opciones de subida
   * @returns {Object} Resultado de la subida
   */
  async uploadToS3(filePath, options = {}) {
    try {
      if (!this.s3Configured) {
        throw new Error('AWS S3 no está configurado');
      }

      const {
        bucket = process.env.AWS_S3_BUCKET,
        key,
        acl = 'public-read',
        contentType,
        metadata = {},
        tags = {}
      } = options;

      if (!bucket) {
        throw new Error('Bucket de S3 no especificado');
      }

      // Leer archivo
      const fileContent = await fs.readFile(filePath);
      const fileName = path.basename(filePath);
      const fileExtension = path.extname(filePath);
      
      // Generar key si no se proporciona
      const s3Key = key || `proserv/${Date.now()}-${fileName}`;
      
      // Detectar content type si no se proporciona
      const detectedContentType = contentType || this.getContentType(fileExtension);

      const uploadParams = {
        Bucket: bucket,
        Key: s3Key,
        Body: fileContent,
        ACL: acl,
        ContentType: detectedContentType,
        Metadata: {
          ...metadata,
          uploadedAt: new Date().toISOString(),
          originalName: fileName
        }
      };

      // Agregar tags si se proporcionan
      if (Object.keys(tags).length > 0) {
        const tagString = Object.entries(tags)
          .map(([key, value]) => `${key}=${value}`)
          .join('&');
        uploadParams.Tagging = tagString;
      }

      const result = await this.s3Client.upload(uploadParams).promise();

      // Eliminar archivo temporal
      await this.deleteLocalFile(filePath);

      logger.info('Archivo subido a S3', {
        bucket: result.Bucket,
        key: result.Key,
        location: result.Location,
        etag: result.ETag
      });

      return {
        success: true,
        file: {
          bucket: result.Bucket,
          key: result.Key,
          url: result.Location,
          etag: result.ETag,
          contentType: detectedContentType,
          uploadedAt: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('Error subiendo a S3', {
        filePath,
        error: error.message
      });
      
      // Intentar eliminar archivo temporal en caso de error
      await this.deleteLocalFile(filePath).catch(() => {});
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Subir múltiples archivos
   * @param {Array} files - Array de archivos de multer
   * @param {Object} options - Opciones de subida
   * @returns {Object} Resultado de las subidas
   */
  async uploadMultipleFiles(files, options = {}) {
    try {
      const {
        provider = 'cloudinary', // 'cloudinary' o 's3'
        ...uploadOptions
      } = options;

      const results = [];
      const errors = [];

      for (const file of files) {
        try {
          let result;
          
          if (provider === 'cloudinary') {
            result = await this.uploadToCloudinary(file.path, {
              ...uploadOptions,
              folder: `${uploadOptions.folder || 'proserv'}/${file.fieldname}`
            });
          } else if (provider === 's3') {
            result = await this.uploadToS3(file.path, {
              ...uploadOptions,
              key: `${uploadOptions.keyPrefix || 'proserv'}/${file.fieldname}/${file.filename}`
            });
          } else {
            throw new Error(`Proveedor no soportado: ${provider}`);
          }

          if (result.success) {
            results.push({
              fieldname: file.fieldname,
              originalname: file.originalname,
              ...result.file
            });
          } else {
            errors.push({
              fieldname: file.fieldname,
              originalname: file.originalname,
              error: result.error
            });
          }
          
        } catch (error) {
          errors.push({
            fieldname: file.fieldname,
            originalname: file.originalname,
            error: error.message
          });
        }
      }

      logger.info('Subida múltiple completada', {
        totalFiles: files.length,
        successful: results.length,
        failed: errors.length,
        provider
      });

      return {
        success: results.length > 0,
        results,
        errors,
        summary: {
          total: files.length,
          successful: results.length,
          failed: errors.length
        }
      };
      
    } catch (error) {
      logger.error('Error en subida múltiple', {
        error: error.message,
        filesCount: files.length
      });
      
      return {
        success: false,
        error: error.message,
        results: [],
        errors: []
      };
    }
  }

  /**
   * Eliminar archivo de Cloudinary
   * @param {string} publicId - ID público del archivo
   * @param {string} resourceType - Tipo de recurso
   * @returns {Object} Resultado de la eliminación
   */
  async deleteFromCloudinary(publicId, resourceType = 'image') {
    try {
      if (!this.cloudinaryConfigured) {
        throw new Error('Cloudinary no está configurado');
      }

      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType
      });

      logger.info('Archivo eliminado de Cloudinary', {
        publicId,
        result: result.result
      });

      return {
        success: result.result === 'ok',
        result: result.result
      };
      
    } catch (error) {
      logger.error('Error eliminando de Cloudinary', {
        publicId,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Eliminar archivo de S3
   * @param {string} bucket - Bucket de S3
   * @param {string} key - Key del archivo
   * @returns {Object} Resultado de la eliminación
   */
  async deleteFromS3(bucket, key) {
    try {
      if (!this.s3Configured) {
        throw new Error('AWS S3 no está configurado');
      }

      const deleteParams = {
        Bucket: bucket,
        Key: key
      };

      await this.s3Client.deleteObject(deleteParams).promise();

      logger.info('Archivo eliminado de S3', {
        bucket,
        key
      });

      return {
        success: true
      };
      
    } catch (error) {
      logger.error('Error eliminando de S3', {
        bucket,
        key,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Eliminar archivo local
   * @param {string} filePath - Ruta del archivo
   */
  async deleteLocalFile(filePath) {
    try {
      await fs.unlink(filePath);
      logger.debug('Archivo local eliminado', { filePath });
    } catch (error) {
      logger.warn('Error eliminando archivo local', {
        filePath,
        error: error.message
      });
    }
  }

  /**
   * Generar URL firmada para S3
   * @param {string} bucket - Bucket de S3
   * @param {string} key - Key del archivo
   * @param {number} expires - Tiempo de expiración en segundos
   * @returns {string} URL firmada
   */
  generateS3SignedUrl(bucket, key, expires = 3600) {
    try {
      if (!this.s3Configured) {
        throw new Error('AWS S3 no está configurado');
      }

      const params = {
        Bucket: bucket,
        Key: key,
        Expires: expires
      };

      const signedUrl = this.s3Client.getSignedUrl('getObject', params);

      logger.debug('URL firmada generada', {
        bucket,
        key,
        expires
      });

      return signedUrl;
      
    } catch (error) {
      logger.error('Error generando URL firmada', {
        bucket,
        key,
        error: error.message
      });
      
      return null;
    }
  }

  /**
   * Obtener transformaciones de imagen para Cloudinary
   * @param {string} type - Tipo de transformación
   * @returns {Object} Configuración de transformación
   */
  getImageTransformation(type) {
    const transformations = {
      avatar: {
        width: 200,
        height: 200,
        crop: 'fill',
        gravity: 'face',
        quality: 'auto',
        format: 'webp'
      },
      thumbnail: {
        width: 300,
        height: 200,
        crop: 'fill',
        quality: 'auto',
        format: 'webp'
      },
      gallery: {
        width: 800,
        height: 600,
        crop: 'limit',
        quality: 'auto',
        format: 'webp'
      },
      fullsize: {
        width: 1920,
        height: 1080,
        crop: 'limit',
        quality: 'auto',
        format: 'webp'
      }
    };

    return transformations[type] || transformations.thumbnail;
  }

  /**
   * Detectar content type basado en extensión
   * @param {string} extension - Extensión del archivo
   * @returns {string} Content type
   */
  getContentType(extension) {
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain'
    };

    return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Validar archivo
   * @param {Object} file - Archivo de multer
   * @param {Object} rules - Reglas de validación
   * @returns {Object} Resultado de la validación
   */
  validateFile(file, rules = {}) {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB
      allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
      allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp']
    } = rules;

    const errors = [];

    // Validar tamaño
    if (file.size > maxSize) {
      errors.push(`Archivo demasiado grande. Máximo: ${maxSize / 1024 / 1024}MB`);
    }

    // Validar tipo MIME
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`Tipo de archivo no permitido: ${file.mimetype}`);
    }

    // Validar extensión
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      errors.push(`Extensión no permitida: ${extension}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Limpiar archivos temporales antiguos
   * @param {string} directory - Directorio a limpiar
   * @param {number} maxAge - Edad máxima en milisegundos
   */
  async cleanupTempFiles(directory = './uploads/temp', maxAge = 24 * 60 * 60 * 1000) {
    try {
      const files = await fs.readdir(directory);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      logger.info('Limpieza de archivos temporales completada', {
        directory,
        deletedCount,
        totalFiles: files.length
      });
      
    } catch (error) {
      logger.error('Error limpiando archivos temporales', {
        directory,
        error: error.message
      });
    }
  }

  /**
   * Obtener estadísticas del servicio
   */
  getStats() {
    return {
      cloudinaryConfigured: this.cloudinaryConfigured,
      s3Configured: this.s3Configured,
      providers: {
        cloudinary: this.cloudinaryConfigured,
        s3: this.s3Configured
      }
    };
  }
}

// Instancia singleton
const storageService = new StorageService();

module.exports = {
  StorageService,
  storageService
};