const axios = require('axios');
const logger = require('./logger');

/**
 * Utilidades para manejo de geolocalización
 */

class GeolocationUtils {
  /**
   * Calcular distancia entre dos puntos usando la fórmula de Haversine
   * @param {Array} point1 - [longitude, latitude]
   * @param {Array} point2 - [longitude, latitude]
   * @returns {number} Distancia en kilómetros
   */
  static calculateDistance(point1, point2) {
    const [lon1, lat1] = point1;
    const [lon2, lat2] = point2;
    
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // Redondear a 2 decimales
  }

  /**
   * Convertir grados a radianes
   */
  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convertir radianes a grados
   */
  static toDegrees(radians) {
    return radians * (180 / Math.PI);
  }

  /**
   * Validar coordenadas
   * @param {Array} coordinates - [longitude, latitude]
   * @returns {boolean} True si las coordenadas son válidas
   */
  static validateCoordinates(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      return false;
    }
    
    const [longitude, latitude] = coordinates;
    
    return (
      typeof longitude === 'number' &&
      typeof latitude === 'number' &&
      longitude >= -180 && longitude <= 180 &&
      latitude >= -90 && latitude <= 90
    );
  }

  /**
   * Obtener coordenadas desde dirección usando Google Maps API
   * @param {string} address - Dirección a geocodificar
   * @returns {Object} Resultado de geocodificación
   */
  static async geocodeAddress(address) {
    try {
      if (!process.env.GOOGLE_MAPS_API_KEY) {
        throw new Error('Google Maps API key no configurada');
      }

      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address,
          key: process.env.GOOGLE_MAPS_API_KEY,
          language: 'es',
          region: 'co' // Ajustar según el país principal
        },
        timeout: 10000
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Error de geocodificación: ${response.data.status}`);
      }

      const result = response.data.results[0];
      const location = result.geometry.location;
      
      return {
        success: true,
        coordinates: [location.lng, location.lat],
        formattedAddress: result.formatted_address,
        addressComponents: this.parseAddressComponents(result.address_components),
        placeId: result.place_id,
        locationType: result.geometry.location_type,
        viewport: result.geometry.viewport
      };
      
    } catch (error) {
      logger.error('Error en geocodificación', {
        address,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtener dirección desde coordenadas (geocodificación inversa)
   * @param {Array} coordinates - [longitude, latitude]
   * @returns {Object} Resultado de geocodificación inversa
   */
  static async reverseGeocode(coordinates) {
    try {
      if (!this.validateCoordinates(coordinates)) {
        throw new Error('Coordenadas inválidas');
      }

      if (!process.env.GOOGLE_MAPS_API_KEY) {
        throw new Error('Google Maps API key no configurada');
      }

      const [longitude, latitude] = coordinates;
      
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          latlng: `${latitude},${longitude}`,
          key: process.env.GOOGLE_MAPS_API_KEY,
          language: 'es',
          result_type: 'street_address|route|neighborhood|locality'
        },
        timeout: 10000
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Error de geocodificación inversa: ${response.data.status}`);
      }

      const result = response.data.results[0];
      
      return {
        success: true,
        formattedAddress: result.formatted_address,
        addressComponents: this.parseAddressComponents(result.address_components),
        placeId: result.place_id,
        types: result.types
      };
      
    } catch (error) {
      logger.error('Error en geocodificación inversa', {
        coordinates,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parsear componentes de dirección de Google Maps
   */
  static parseAddressComponents(components) {
    const parsed = {};
    
    const typeMapping = {
      street_number: 'streetNumber',
      route: 'street',
      neighborhood: 'neighborhood',
      locality: 'city',
      administrative_area_level_1: 'state',
      administrative_area_level_2: 'county',
      country: 'country',
      postal_code: 'postalCode'
    };
    
    components.forEach(component => {
      component.types.forEach(type => {
        if (typeMapping[type]) {
          parsed[typeMapping[type]] = component.long_name;
          parsed[`${typeMapping[type]}Short`] = component.short_name;
        }
      });
    });
    
    return parsed;
  }

  /**
   * Calcular bounding box para un punto y radio
   * @param {Array} center - [longitude, latitude]
   * @param {number} radiusKm - Radio en kilómetros
   * @returns {Object} Bounding box
   */
  static calculateBoundingBox(center, radiusKm) {
    const [centerLng, centerLat] = center;
    
    // Aproximación: 1 grado de latitud ≈ 111 km
    // 1 grado de longitud ≈ 111 km * cos(latitud)
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(this.toRadians(centerLat)));
    
    return {
      north: centerLat + latDelta,
      south: centerLat - latDelta,
      east: centerLng + lngDelta,
      west: centerLng - lngDelta
    };
  }

  /**
   * Verificar si un punto está dentro de un bounding box
   * @param {Array} point - [longitude, latitude]
   * @param {Object} boundingBox - Bounding box
   * @returns {boolean} True si está dentro
   */
  static isPointInBoundingBox(point, boundingBox) {
    const [lng, lat] = point;
    const { north, south, east, west } = boundingBox;
    
    return lat >= south && lat <= north && lng >= west && lng <= east;
  }

  /**
   * Obtener lugares cercanos usando Google Places API
   * @param {Array} coordinates - [longitude, latitude]
   * @param {string} type - Tipo de lugar
   * @param {number} radius - Radio en metros
   * @returns {Object} Lugares cercanos
   */
  static async getNearbyPlaces(coordinates, type = 'establishment', radius = 1000) {
    try {
      if (!this.validateCoordinates(coordinates)) {
        throw new Error('Coordenadas inválidas');
      }

      if (!process.env.GOOGLE_MAPS_API_KEY) {
        throw new Error('Google Maps API key no configurada');
      }

      const [longitude, latitude] = coordinates;
      
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: {
          location: `${latitude},${longitude}`,
          radius,
          type,
          key: process.env.GOOGLE_MAPS_API_KEY,
          language: 'es'
        },
        timeout: 10000
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Error buscando lugares: ${response.data.status}`);
      }

      const places = response.data.results.map(place => ({
        placeId: place.place_id,
        name: place.name,
        address: place.vicinity,
        coordinates: [place.geometry.location.lng, place.geometry.location.lat],
        rating: place.rating,
        types: place.types,
        priceLevel: place.price_level,
        isOpen: place.opening_hours?.open_now,
        photos: place.photos?.map(photo => ({
          reference: photo.photo_reference,
          width: photo.width,
          height: photo.height
        }))
      }));

      return {
        success: true,
        places,
        nextPageToken: response.data.next_page_token
      };
      
    } catch (error) {
      logger.error('Error buscando lugares cercanos', {
        coordinates,
        type,
        radius,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calcular tiempo y distancia de viaje entre dos puntos
   * @param {Array} origin - [longitude, latitude]
   * @param {Array} destination - [longitude, latitude]
   * @param {string} mode - Modo de transporte (driving, walking, transit, bicycling)
   * @returns {Object} Información de viaje
   */
  static async getDirections(origin, destination, mode = 'driving') {
    try {
      if (!this.validateCoordinates(origin) || !this.validateCoordinates(destination)) {
        throw new Error('Coordenadas inválidas');
      }

      if (!process.env.GOOGLE_MAPS_API_KEY) {
        throw new Error('Google Maps API key no configurada');
      }

      const [originLng, originLat] = origin;
      const [destLng, destLat] = destination;
      
      const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
        params: {
          origin: `${originLat},${originLng}`,
          destination: `${destLat},${destLng}`,
          mode,
          key: process.env.GOOGLE_MAPS_API_KEY,
          language: 'es',
          units: 'metric'
        },
        timeout: 15000
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Error obteniendo direcciones: ${response.data.status}`);
      }

      const route = response.data.routes[0];
      const leg = route.legs[0];
      
      return {
        success: true,
        distance: {
          text: leg.distance.text,
          value: leg.distance.value // metros
        },
        duration: {
          text: leg.duration.text,
          value: leg.duration.value // segundos
        },
        startAddress: leg.start_address,
        endAddress: leg.end_address,
        steps: leg.steps.map(step => ({
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Remover HTML
          distance: step.distance.text,
          duration: step.duration.text,
          maneuver: step.maneuver
        })),
        polyline: route.overview_polyline.points
      };
      
    } catch (error) {
      logger.error('Error obteniendo direcciones', {
        origin,
        destination,
        mode,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validar si una dirección está dentro de un área de servicio
   * @param {Array} targetCoordinates - Coordenadas del objetivo
   * @param {Array} serviceCenter - Centro del área de servicio
   * @param {number} serviceRadius - Radio de servicio en km
   * @returns {Object} Resultado de validación
   */
  static validateServiceArea(targetCoordinates, serviceCenter, serviceRadius) {
    if (!this.validateCoordinates(targetCoordinates) || !this.validateCoordinates(serviceCenter)) {
      return {
        isValid: false,
        error: 'Coordenadas inválidas'
      };
    }

    const distance = this.calculateDistance(serviceCenter, targetCoordinates);
    const isWithinArea = distance <= serviceRadius;
    
    return {
      isValid: isWithinArea,
      distance,
      serviceRadius,
      exceedsBy: isWithinArea ? 0 : distance - serviceRadius
    };
  }

  /**
   * Encontrar el punto más cercano de una lista
   * @param {Array} targetCoordinates - Coordenadas objetivo
   * @param {Array} points - Array de objetos con coordenadas
   * @param {string} coordinatesField - Campo que contiene las coordenadas
   * @returns {Object} Punto más cercano con distancia
   */
  static findNearestPoint(targetCoordinates, points, coordinatesField = 'coordinates') {
    if (!this.validateCoordinates(targetCoordinates) || !Array.isArray(points) || points.length === 0) {
      return null;
    }

    let nearest = null;
    let minDistance = Infinity;

    points.forEach(point => {
      const pointCoordinates = point[coordinatesField];
      if (this.validateCoordinates(pointCoordinates)) {
        const distance = this.calculateDistance(targetCoordinates, pointCoordinates);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = {
            ...point,
            distance
          };
        }
      }
    });

    return nearest;
  }

  /**
   * Ordenar puntos por distancia
   * @param {Array} targetCoordinates - Coordenadas objetivo
   * @param {Array} points - Array de objetos con coordenadas
   * @param {string} coordinatesField - Campo que contiene las coordenadas
   * @param {number} limit - Límite de resultados
   * @returns {Array} Puntos ordenados por distancia
   */
  static sortByDistance(targetCoordinates, points, coordinatesField = 'coordinates', limit = null) {
    if (!this.validateCoordinates(targetCoordinates) || !Array.isArray(points)) {
      return [];
    }

    const pointsWithDistance = points
      .map(point => {
        const pointCoordinates = point[coordinatesField];
        if (this.validateCoordinates(pointCoordinates)) {
          return {
            ...point,
            distance: this.calculateDistance(targetCoordinates, pointCoordinates)
          };
        }
        return null;
      })
      .filter(point => point !== null)
      .sort((a, b) => a.distance - b.distance);

    return limit ? pointsWithDistance.slice(0, limit) : pointsWithDistance;
  }

  /**
   * Generar coordenadas aleatorias dentro de un radio
   * @param {Array} center - Centro [longitude, latitude]
   * @param {number} radiusKm - Radio en kilómetros
   * @returns {Array} Coordenadas aleatorias
   */
  static generateRandomCoordinatesInRadius(center, radiusKm) {
    const [centerLng, centerLat] = center;
    
    // Generar ángulo aleatorio
    const angle = Math.random() * 2 * Math.PI;
    
    // Generar distancia aleatoria (distribución uniforme en área)
    const distance = Math.sqrt(Math.random()) * radiusKm;
    
    // Convertir a coordenadas
    const latDelta = (distance / 111) * Math.cos(angle);
    const lngDelta = (distance / (111 * Math.cos(this.toRadians(centerLat)))) * Math.sin(angle);
    
    return [
      centerLng + lngDelta,
      centerLat + latDelta
    ];
  }

  /**
   * Formatear coordenadas para mostrar
   * @param {Array} coordinates - [longitude, latitude]
   * @param {number} precision - Número de decimales
   * @returns {string} Coordenadas formateadas
   */
  static formatCoordinates(coordinates, precision = 6) {
    if (!this.validateCoordinates(coordinates)) {
      return 'Coordenadas inválidas';
    }
    
    const [lng, lat] = coordinates;
    return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
  }

  /**
   * Convertir coordenadas a diferentes formatos
   * @param {Array} coordinates - [longitude, latitude]
   * @returns {Object} Coordenadas en diferentes formatos
   */
  static convertCoordinateFormats(coordinates) {
    if (!this.validateCoordinates(coordinates)) {
      return null;
    }
    
    const [lng, lat] = coordinates;
    
    return {
      decimal: { latitude: lat, longitude: lng },
      geoJson: [lng, lat],
      dms: {
        latitude: this.decimalToDMS(lat, 'lat'),
        longitude: this.decimalToDMS(lng, 'lng')
      },
      googleMaps: `${lat},${lng}`,
      openStreetMap: `${lat},${lng}`
    };
  }

  /**
   * Convertir coordenadas decimales a grados, minutos, segundos
   */
  static decimalToDMS(decimal, type) {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutes = Math.floor((absolute - degrees) * 60);
    const seconds = ((absolute - degrees - minutes / 60) * 3600).toFixed(2);
    
    const direction = type === 'lat' 
      ? (decimal >= 0 ? 'N' : 'S')
      : (decimal >= 0 ? 'E' : 'W');
    
    return `${degrees}°${minutes}'${seconds}"${direction}`;
  }
}

module.exports = {
  GeolocationUtils
};