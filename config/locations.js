/**
 * Configuración de ubicaciones para Colombia
 * Incluye ciudades principales, departamentos y coordenadas
 */

const COLOMBIA_LOCATIONS = {
  // Ciudades principales con coordenadas
  cities: {
    bogota: {
      name: 'Bogotá',
      department: 'Bogotá D.C.',
      coordinates: {
        latitude: 4.7110,
        longitude: -74.0721
      },
      timezone: 'America/Bogota'
    },
    medellin: {
      name: 'Medellín',
      department: 'Antioquia',
      coordinates: {
        latitude: 6.2442,
        longitude: -75.5812
      },
      timezone: 'America/Bogota'
    },
    cali: {
      name: 'Cali',
      department: 'Valle del Cauca',
      coordinates: {
        latitude: 3.4516,
        longitude: -76.5320
      },
      timezone: 'America/Bogota'
    },
    barranquilla: {
      name: 'Barranquilla',
      department: 'Atlántico',
      coordinates: {
        latitude: 10.9639,
        longitude: -74.7964
      },
      timezone: 'America/Bogota'
    },
    cartagena: {
      name: 'Cartagena',
      department: 'Bolívar',
      coordinates: {
        latitude: 10.3910,
        longitude: -75.4794
      },
      timezone: 'America/Bogota'
    },
    bucaramanga: {
      name: 'Bucaramanga',
      department: 'Santander',
      coordinates: {
        latitude: 7.1193,
        longitude: -73.1227
      },
      timezone: 'America/Bogota'
    }
  },

  // Departamentos de Colombia
  departments: [
    'Bogotá D.C.',
    'Antioquia',
    'Valle del Cauca',
    'Cundinamarca',
    'Atlántico',
    'Santander',
    'Bolívar',
    'Norte de Santander',
    'Córdoba',
    'Tolima',
    'Huila',
    'Nariño',
    'Meta',
    'Cesar',
    'Sucre',
    'La Guajira',
    'Magdalena',
    'Boyacá',
    'Caldas',
    'Risaralda',
    'Quindío',
    'Cauca',
    'Casanare',
    'Putumayo',
    'Caquetá',
    'Arauca',
    'Amazonas',
    'Guainía',
    'Guaviare',
    'Vaupés',
    'Vichada',
    'San Andrés y Providencia'
  ],

  // Configuración por defecto
  default: {
    country: 'Colombia',
    countryCode: 'CO',
    currency: 'COP',
    timezone: 'America/Bogota',
    locale: 'es-CO',
    city: 'bogota'
  }
};

/**
 * Obtiene la configuración de una ciudad
 * @param {string} cityKey - Clave de la ciudad
 * @returns {Object} Configuración de la ciudad
 */
function getCityConfig(cityKey) {
  return COLOMBIA_LOCATIONS.cities[cityKey] || COLOMBIA_LOCATIONS.cities[COLOMBIA_LOCATIONS.default.city];
}

/**
 * Obtiene todas las ciudades disponibles
 * @returns {Array} Lista de ciudades
 */
function getAllCities() {
  return Object.values(COLOMBIA_LOCATIONS.cities);
}

/**
 * Obtiene todos los departamentos
 * @returns {Array} Lista de departamentos
 */
function getAllDepartments() {
  return COLOMBIA_LOCATIONS.departments;
}

/**
 * Valida si un departamento existe
 * @param {string} department - Nombre del departamento
 * @returns {boolean} True si existe
 */
function isValidDepartment(department) {
  return COLOMBIA_LOCATIONS.departments.includes(department);
}

/**
 * Obtiene la configuración por defecto
 * @returns {Object} Configuración por defecto
 */
function getDefaultConfig() {
  return COLOMBIA_LOCATIONS.default;
}

module.exports = {
  COLOMBIA_LOCATIONS,
  getCityConfig,
  getAllCities,
  getAllDepartments,
  isValidDepartment,
  getDefaultConfig
};