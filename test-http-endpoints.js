const http = require('http');

// Función para hacer peticiones HTTP simples
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

async function testEndpoints() {
  console.log('Probando endpoints HTTP del servidor...');
  
  try {
    // Test 1: Probar endpoint de login con datos inválidos
    console.log('\n1. Probando POST /api/auth/login...');
    const loginData = JSON.stringify({
      email: 'test@test.com',
      password: 'wrongpassword'
    });
    
    const loginOptions = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    };
    
    const loginResponse = await makeRequest(loginOptions, loginData);
    console.log(`Status: ${loginResponse.statusCode}`);
    console.log(`Response: ${loginResponse.body}`);
    
    // Test 2: Probar endpoint de registro
    console.log('\n2. Probando POST /api/auth/register...');
    const registerData = JSON.stringify({
      email: 'test-' + Date.now() + '@test.com',
      password: 'TestPassword123!',
      role: 'client',
      profile: {
        firstName: 'Test',
        lastName: 'User',
        phone: '+1234567890'
      }
    });
    
    const registerOptions = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(registerData)
      }
    };
    
    const registerResponse = await makeRequest(registerOptions, registerData);
    console.log(`Status: ${registerResponse.statusCode}`);
    console.log(`Response: ${registerResponse.body}`);
    
    // Test 3: Probar un endpoint GET simple
    console.log('\n3. Probando GET /api/users (sin auth)...');
    const getUsersOptions = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/users',
      method: 'GET'
    };
    
    const getUsersResponse = await makeRequest(getUsersOptions);
    console.log(`Status: ${getUsersResponse.statusCode}`);
    console.log(`Response: ${getUsersResponse.body}`);
    
  } catch (error) {
    console.log('Error en las pruebas:', error.message);
    console.log('Stack trace:', error.stack);
    console.log('Error completo:', error);
  }
}

testEndpoints();