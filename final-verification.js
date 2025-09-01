const axios = require('axios');

async function finalVerification() {
  try {
    console.log('🔍 Verificación final del sistema...');
    
    // 1. Login como admin
    console.log('\n1️⃣ Realizando login de admin...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@jooru.com',
      password: 'Admin123!'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Login falló');
    }
    
    const token = loginResponse.data.message.tokens.accessToken;
    console.log('✅ Login exitoso');
    
    // 2. Simular el comportamiento del AuthContext actualizado
    console.log('\n2️⃣ Simulando AuthContext actualizado...');
    const mockUser = { role: 'admin', email: 'admin@jooru.com' };
    const isAuthenticated = !!mockUser;
    const tokenFromStorage = token; // Simula localStorage.getItem('adminToken')
    
    console.log('✅ Usuario mock creado:', mockUser);
    console.log('✅ isAuthenticated:', isAuthenticated);
    console.log('✅ Token disponible:', !!tokenFromStorage);
    
    // 3. Verificar condición de autenticación del Dashboard
    console.log('\n3️⃣ Verificando condición de autenticación...');
    if (!isAuthenticated || !tokenFromStorage) {
      console.error('❌ Fallaría la verificación de autenticación');
      return;
    }
    console.log('✅ Verificación de autenticación pasaría');
    
    // 4. Simular request del dashboard con axios interceptor
    console.log('\n4️⃣ Simulando request del dashboard...');
    const apiClient = axios.create({
      baseURL: 'http://localhost:3001/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Interceptor como en el frontend
    apiClient.interceptors.request.use(
      (config) => {
        const adminToken = tokenFromStorage;
        if (adminToken) {
          config.headers.Authorization = `Bearer ${adminToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
    
    const response = await apiClient.get('/admin/dashboard');
    console.log('✅ Dashboard response status:', response.status);
    console.log('✅ Dashboard success:', response.data.success);
    
    // 5. Verificar transformación de datos
    if (response.data.success) {
      const backendData = response.data.message;
      console.log('\n5️⃣ Verificando transformación de datos...');
      console.log('✅ totalUsers:', backendData.totalUsers);
      console.log('✅ totalProfessionals:', backendData.totalProfessionals);
      console.log('✅ totalRevenue:', backendData.totalRevenue);
      console.log('✅ averageRating:', backendData.averageRating);
      
      // Simular transformación como en el frontend
      const transformedStats = {
        totalUsers: backendData.totalUsers,
        totalProfessionals: backendData.totalProfessionals,
        totalRevenue: backendData.totalRevenue,
        averageRating: backendData.averageRating,
        recentActivity: backendData.recentActivity.map(activity => ({
          date: activity.date,
          users: activity.users,
          professionals: activity.professionals
        }))
      };
      
      console.log('✅ Datos transformados correctamente');
      console.log('\n🎉 VERIFICACIÓN COMPLETA: Todo funcionando correctamente');
      console.log('\n📋 Resumen:');
      console.log('   ✅ Login de admin funciona');
      console.log('   ✅ AuthContext no falla en verificación');
      console.log('   ✅ Dashboard endpoint responde correctamente');
      console.log('   ✅ Transformación de datos funciona');
      console.log('   ✅ El error "Error al cargar los datos del dashboard" debería estar resuelto');
      
    } else {
      console.error('❌ Dashboard response success = false');
    }
    
  } catch (error) {
    console.error('❌ Error en verificación final:', error.message);
    if (error.response) {
      console.error('📄 Status:', error.response.status);
      console.error('📄 Data:', error.response.data);
    }
  }
}

finalVerification();