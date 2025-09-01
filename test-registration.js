const axios = require('axios');
require('dotenv').config();

async function testRegistration() {
  console.log('=== PRUEBA DE REGISTRO DE USUARIOS ===\n');
  
  const baseURL = 'http://localhost:3001';
  
  try {
    // Test 1: Registro de cliente
    console.log('1. Probando registro de cliente...');
    const clientData = {
      email: `cliente-test-${Date.now()}@ejemplo.com`,
      password: 'TestPassword123!',
      role: 'client',
      profile: {
        firstName: 'Cliente',
        lastName: 'Prueba',
        phone: '+1234567890'
      },
      acceptTerms: true,
      acceptPrivacy: true
    };
    
    const clientResponse = await axios.post(`${baseURL}/api/auth/register`, clientData);
    console.log('Status:', clientResponse.status);
    console.log('Response:', JSON.stringify(clientResponse.data, null, 2));
    
    // Test 2: Registro de profesional
    console.log('\n2. Probando registro de profesional...');
    const professionalData = {
      email: `profesional-test-${Date.now()}@ejemplo.com`,
      password: 'TestPassword123!',
      role: 'professional',
      profile: {
        firstName: 'Profesional',
        lastName: 'Prueba',
        phone: '+1234567891'
      },
      businessInfo: {
        businessName: 'Servicios Prueba',
        profession: 'Plomería',
        experience: '3-5 años',
        description: 'Servicios de plomería profesional'
      },
      acceptTerms: true,
      acceptPrivacy: true
    };
    
    const professionalResponse = await axios.post(`${baseURL}/api/auth/register`, professionalData);
    console.log('Status:', professionalResponse.status);
    console.log('Response:', JSON.stringify(professionalResponse.data, null, 2));
    
    // Test 3: Intentar registro con email duplicado
    console.log('\n3. Probando registro con email duplicado...');
    try {
      const duplicateResponse = await axios.post(`${baseURL}/api/auth/register`, clientData);
      console.log('Status:', duplicateResponse.status);
      console.log('Response:', JSON.stringify(duplicateResponse.data, null, 2));
    } catch (duplicateError) {
      console.log('Error esperado - Email duplicado:');
      console.log('Status:', duplicateError.response?.status);
      console.log('Response:', JSON.stringify(duplicateError.response?.data, null, 2));
    }
    
    // Test 4: Registro con datos inválidos
    console.log('\n4. Probando registro con datos inválidos...');
    try {
      const invalidData = {
        email: 'email-invalido',
        password: '123', // muy corta
        role: 'invalid-role'
      };
      
      const invalidResponse = await axios.post(`${baseURL}/api/auth/register`, invalidData);
      console.log('Status:', invalidResponse.status);
      console.log('Response:', JSON.stringify(invalidResponse.data, null, 2));
    } catch (invalidError) {
      console.log('Error esperado - Datos inválidos:');
      console.log('Status:', invalidError.response?.status);
      console.log('Response:', JSON.stringify(invalidError.response?.data, null, 2));
    }
    
  } catch (error) {
    console.error('Error en las pruebas:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testRegistration();