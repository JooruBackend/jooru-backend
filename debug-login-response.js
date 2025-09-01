const axios = require('axios');

async function debugLoginResponse() {
  try {
    console.log('=== Debug completo de la respuesta de login ===\n');
    
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@jooru.com',
      password: 'Admin123!'
    });
    
    console.log('Status:', response.status);
    console.log('\nRespuesta completa:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\nAnálisis de la estructura:');
    console.log('- response.data.success:', response.data.success);
    console.log('- response.data.data:', !!response.data.data);
    console.log('- response.data.message:', !!response.data.message);
    
    if (response.data.data) {
      console.log('\nContenido de data:');
      console.log('- data.token:', !!response.data.data.token);
      console.log('- data.user:', !!response.data.data.user);
      console.log('- data.tokens:', !!response.data.data.tokens);
      
      if (response.data.data.tokens) {
        console.log('- data.tokens.accessToken:', !!response.data.data.tokens.accessToken);
      }
    }
    
    if (response.data.message) {
      console.log('\nContenido de message:');
      console.log('- message.token:', !!response.data.message.token);
      console.log('- message.tokens:', !!response.data.message.tokens);
      
      if (response.data.message.tokens) {
        console.log('- message.tokens.accessToken:', !!response.data.message.tokens.accessToken);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

debugLoginResponse();