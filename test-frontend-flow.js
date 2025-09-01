const axios = require('axios');

// Simular el flujo completo del frontend
class FrontendSimulator {
  constructor() {
    this.localStorage = {};
    this.apiClient = axios.create({
      baseURL: 'http://localhost:3001/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Interceptor para agregar token automáticamente
    this.apiClient.interceptors.request.use((config) => {
      const token = this.localStorage.adminToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }
  
  async login(email, password) {
    console.log('🔐 Iniciando proceso de login...');
    console.log('Email:', email);
    
    try {
      const response = await this.apiClient.post('/auth/login', {
        email,
        password,
      });
      
      console.log('✅ Respuesta del servidor recibida');
      console.log('Status:', response.status);
      console.log('Success:', response.data.success);
      
      if (response.data.success) {
        console.log('\n🔍 Procesando respuesta exitosa...');
        
        // Simular exactamente lo que hace AuthContext
        const { tokens, user: userData } = response.data.message;
        const newToken = tokens.accessToken;
        
        console.log('Token extraído:', newToken ? 'SÍ' : 'NO');
        console.log('Usuario extraído:', userData ? 'SÍ' : 'NO');
        
        if (newToken && userData) {
          // Simular localStorage
          this.localStorage.adminToken = newToken;
          console.log('✅ Token guardado en localStorage');
          console.log('✅ Usuario establecido:', userData.profile.fullName);
          
          // Probar verificación del token
          await this.verifyToken();
          
          return { success: true };
        } else {
          console.log('❌ Faltan datos en la respuesta');
          return { success: false, message: 'Datos incompletos en la respuesta' };
        }
      } else {
        console.log('❌ Login fallido según el servidor');
        return {
          success: false,
          message: response.data.message || 'Error de autenticación',
        };
      }
    } catch (error) {
      console.error('❌ Error en login:', error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }
      return {
        success: false,
        message: error.response?.data?.message || 'Error de conexión',
      };
    }
  }
  
  async verifyToken() {
    console.log('\n🔍 Verificando token...');
    
    try {
      const response = await this.apiClient.get('/auth/profile');
      console.log('✅ Token válido - Usuario verificado:', response.data.data?.profile?.fullName);
      return true;
    } catch (error) {
      console.error('❌ Token inválido:', error.response?.status, error.response?.data?.message);
      return false;
    }
  }
}

async function testCompleteFlow() {
  console.log('🧪 Simulando flujo completo del frontend...\n');
  
  const simulator = new FrontendSimulator();
  
  // Probar login
  const result = await simulator.login('admin@jooru.com', 'Admin123!');
  
  console.log('\n🏁 Resultado final del login:');
  console.log('Success:', result.success);
  if (!result.success) {
    console.log('Message:', result.message);
  }
}

testCompleteFlow();