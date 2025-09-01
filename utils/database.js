const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Utilidades para manejo de base de datos MongoDB
 */

class DatabaseUtils {
  /**
   * Conectar a MongoDB
   */
  static async connect() {
    try {
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
        serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 5000,
        socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,

        autoIndex: process.env.NODE_ENV !== 'production'
      };

      await mongoose.connect(process.env.MONGODB_URI, options);
      
      logger.info('Conexión a MongoDB establecida exitosamente', {
        database: mongoose.connection.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port
      });

      // Configurar eventos de conexión
      this.setupConnectionEvents();
      
    } catch (error) {
      logger.error('Error al conectar con MongoDB', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }

  /**
   * Configurar eventos de conexión
   */
  static setupConnectionEvents() {
    const db = mongoose.connection;

    db.on('error', (error) => {
      logger.error('Error de conexión MongoDB', {
        error: error.message,
        stack: error.stack
      });
    });

    db.on('disconnected', () => {
      logger.warn('MongoDB desconectado');
    });

    db.on('reconnected', () => {
      logger.info('MongoDB reconectado');
    });

    // Manejar cierre graceful
    process.on('SIGINT', async () => {
      try {
        await db.close();
        logger.info('Conexión MongoDB cerrada por terminación de aplicación');
        process.exit(0);
      } catch (error) {
        logger.error('Error al cerrar conexión MongoDB', { error: error.message });
        process.exit(1);
      }
    });
  }

  /**
   * Verificar estado de conexión
   */
  static isConnected() {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Obtener estadísticas de la base de datos
   */
  static async getStats() {
    try {
      const db = mongoose.connection.db;
      const stats = await db.stats();
      
      return {
        database: db.databaseName,
        collections: stats.collections,
        dataSize: this.formatBytes(stats.dataSize),
        storageSize: this.formatBytes(stats.storageSize),
        indexSize: this.formatBytes(stats.indexSize),
        objects: stats.objects,
        avgObjSize: this.formatBytes(stats.avgObjSize)
      };
    } catch (error) {
      logger.error('Error al obtener estadísticas de DB', { error: error.message });
      throw error;
    }
  }

  /**
   * Formatear bytes a formato legible
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Crear índices para optimización
   */
  static async createIndexes() {
    try {
      const collections = {
        users: [
          { email: 1 },
          { 'location.coordinates': '2dsphere' },
          { role: 1, isActive: 1 },
          { createdAt: -1 }
        ],
        professionals: [
          { userId: 1 },
          { 'services.category': 1 },
          { 'location.coordinates': '2dsphere' },
          { isVerified: 1, isActive: 1 },
          { 'rating.average': -1 },
          { createdAt: -1 }
        ],
        servicerequests: [
          { clientId: 1 },
          { professionalId: 1 },
          { status: 1 },
          { category: 1 },
          { 'location.coordinates': '2dsphere' },
          { createdAt: -1 },
          { 'scheduling.preferredDate': 1 }
        ],
        reviews: [
          { serviceRequestId: 1 },
          { reviewerId: 1 },
          { revieweeId: 1 },
          { 'rating.overall': -1 },
          { createdAt: -1 },
          { isPublic: 1 }
        ]
      };

      for (const [collectionName, indexes] of Object.entries(collections)) {
        const collection = mongoose.connection.collection(collectionName);
        
        for (const index of indexes) {
          try {
            await collection.createIndex(index);
            logger.debug(`Índice creado en ${collectionName}`, { index });
          } catch (error) {
            if (error.code !== 85) { // Ignorar error si el índice ya existe
              logger.warn(`Error creando índice en ${collectionName}`, {
                index,
                error: error.message
              });
            }
          }
        }
      }

      logger.info('Índices de base de datos verificados/creados');
    } catch (error) {
      logger.error('Error creando índices', { error: error.message });
    }
  }

  /**
   * Limpiar datos de prueba (solo en desarrollo)
   */
  static async cleanTestData() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('No se puede limpiar datos en producción');
    }

    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      
      for (const collection of collections) {
        await mongoose.connection.db.collection(collection.name).deleteMany({});
      }
      
      logger.info('Datos de prueba limpiados');
    } catch (error) {
      logger.error('Error limpiando datos de prueba', { error: error.message });
      throw error;
    }
  }

  /**
   * Realizar backup de colección
   */
  static async backupCollection(collectionName, outputPath) {
    try {
      const collection = mongoose.connection.collection(collectionName);
      const documents = await collection.find({}).toArray();
      
      const fs = require('fs').promises;
      await fs.writeFile(outputPath, JSON.stringify(documents, null, 2));
      
      logger.info(`Backup de ${collectionName} creado`, {
        collection: collectionName,
        documents: documents.length,
        outputPath
      });
      
      return documents.length;
    } catch (error) {
      logger.error(`Error creando backup de ${collectionName}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Restaurar colección desde backup
   */
  static async restoreCollection(collectionName, inputPath) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Restauración no permitida en producción sin confirmación adicional');
    }

    try {
      const fs = require('fs').promises;
      const data = await fs.readFile(inputPath, 'utf8');
      const documents = JSON.parse(data);
      
      const collection = mongoose.connection.collection(collectionName);
      
      // Limpiar colección existente
      await collection.deleteMany({});
      
      // Insertar documentos
      if (documents.length > 0) {
        await collection.insertMany(documents);
      }
      
      logger.info(`Colección ${collectionName} restaurada`, {
        collection: collectionName,
        documents: documents.length,
        inputPath
      });
      
      return documents.length;
    } catch (error) {
      logger.error(`Error restaurando ${collectionName}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Obtener información de salud de la base de datos
   */
  static async getHealthInfo() {
    try {
      const isConnected = this.isConnected();
      const stats = isConnected ? await this.getStats() : null;
      
      return {
        status: isConnected ? 'connected' : 'disconnected',
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        database: mongoose.connection.name,
        stats
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

/**
 * Utilidades para consultas comunes
 */
class QueryUtils {
  /**
   * Construir pipeline de agregación para paginación
   */
  static buildPaginationPipeline(page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc') {
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    return [
      { $sort: sort },
      { $skip: skip },
      { $limit: limit }
    ];
  }

  /**
   * Construir pipeline para contar documentos
   */
  static buildCountPipeline() {
    return [
      { $count: 'total' }
    ];
  }

  /**
   * Construir filtro de geolocalización
   */
  static buildGeoFilter(coordinates, radiusKm = 10) {
    return {
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: coordinates // [longitude, latitude]
          },
          $maxDistance: radiusKm * 1000 // convertir km a metros
        }
      }
    };
  }

  /**
   * Construir filtro de rango de fechas
   */
  static buildDateRangeFilter(field, startDate, endDate) {
    const filter = {};
    
    if (startDate || endDate) {
      filter[field] = {};
      
      if (startDate) {
        filter[field].$gte = new Date(startDate);
      }
      
      if (endDate) {
        filter[field].$lte = new Date(endDate);
      }
    }
    
    return filter;
  }

  /**
   * Construir filtro de búsqueda de texto
   */
  static buildTextSearchFilter(searchTerm, fields = []) {
    if (!searchTerm) return {};
    
    if (fields.length === 0) {
      // Usar búsqueda de texto completo si no se especifican campos
      return { $text: { $search: searchTerm } };
    }
    
    // Búsqueda por regex en campos específicos
    const regex = new RegExp(searchTerm, 'i');
    return {
      $or: fields.map(field => ({ [field]: regex }))
    };
  }

  /**
   * Construir filtro de rango numérico
   */
  static buildNumericRangeFilter(field, min, max) {
    const filter = {};
    
    if (min !== undefined || max !== undefined) {
      filter[field] = {};
      
      if (min !== undefined) {
        filter[field].$gte = min;
      }
      
      if (max !== undefined) {
        filter[field].$lte = max;
      }
    }
    
    return filter;
  }

  /**
   * Ejecutar consulta con paginación
   */
  static async executeWithPagination(model, filter = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      populate = null,
      select = null
    } = options;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Construir query
    let query = model.find(filter);
    
    if (select) {
      query = query.select(select);
    }
    
    if (populate) {
      query = query.populate(populate);
    }
    
    query = query.sort(sort).skip(skip).limit(limit);

    // Ejecutar consultas en paralelo
    const [documents, total] = await Promise.all([
      query.exec(),
      model.countDocuments(filter)
    ]);

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Ejecutar agregación con paginación
   */
  static async executeAggregationWithPagination(model, pipeline = [], options = {}) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // Pipeline para datos
    const dataPipeline = [
      ...pipeline,
      ...this.buildPaginationPipeline(page, limit, sortBy, sortOrder)
    ];

    // Pipeline para contar
    const countPipeline = [
      ...pipeline,
      ...this.buildCountPipeline()
    ];

    // Ejecutar agregaciones en paralelo
    const [dataResult, countResult] = await Promise.all([
      model.aggregate(dataPipeline),
      model.aggregate(countPipeline)
    ]);

    const total = countResult[0]?.total || 0;

    return {
      documents: dataResult,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Validar ObjectId
   */
  static isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  }

  /**
   * Convertir a ObjectId
   */
  static toObjectId(id) {
    return new mongoose.Types.ObjectId(id);
  }

  /**
   * Construir lookup para población manual
   */
  static buildLookup(from, localField, foreignField, as, pipeline = null) {
    const lookup = {
      $lookup: {
        from,
        localField,
        foreignField,
        as
      }
    };
    
    if (pipeline) {
      lookup.$lookup.pipeline = pipeline;
    }
    
    return lookup;
  }
}

module.exports = {
  DatabaseUtils,
  QueryUtils
};