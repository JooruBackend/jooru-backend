const axios = require('axios');

// Simular exactamente lo que hace el frontend
async function simulateFrontendFlow() {
  try {
    console.log('🔄 Simulando flujo completo del frontend...');
    
    // 1. Login como admin
    console.log('1️⃣ Haciendo login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@jooru.com',
      password: 'Admin123!'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Login falló');
    }
    
    const token = loginResponse.data.message.tokens.accessToken;
    console.log('✅ Login exitoso');
    
    // 2. Crear cliente axios como en el frontend
    const apiClient = axios.create({
      baseURL: 'http://localhost:3001/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // 3. Agregar interceptor como en el frontend
    apiClient.interceptors.request.use(
      (config) => {
        // Simular localStorage.getItem('adminToken')
        const adminToken = token; // En el frontend vendría de localStorage
        if (adminToken) {
          config.headers.Authorization = `Bearer ${adminToken}`;
        }
        console.log('📤 Request config:', {
          url: config.url,
          method: config.method,
          headers: config.headers
        });
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
    
    // 4. Hacer request al dashboard como en el frontend
    console.log('2️⃣ Solicitando datos del dashboard...');
    const response = await apiClient.get('/admin/dashboard');
    
    console.log('✅ Respuesta recibida:', response.status);
    console.log('📊 Success:', response.data.success);
    
    if (response.data.success) {
      const backendData = response.data.message;
      console.log('✅ Datos transformados correctamente');
      console.log('📈 Total Users:', backendData.totalUsers);
      console.log('👨‍💼 Total Professionals:', backendData.totalProfessionals);
      console.log('💰 Total Revenue:', backendData.totalRevenue);
      console.log('⭐ Average Rating:', backendData.averageRating);
    } else {
      console.error('❌ Response success = false');
    }
    
  } catch (error) {
    console.error('❌ Error en simulación:', error.message);
    if (error.response) {
      console.error('📄 Status:', error.response.status);
      console.error('📄 Data:', error.response.data);
      console.error('📄 Headers:', error.response.headers);
    }
    if (error.request) {
      console.error('📡 Request:', error.request);
    }
  }
}

simulateFrontendFlow();