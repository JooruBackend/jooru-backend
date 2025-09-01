const fs = require('fs');
const path = require('path');

// Verificar si existe el archivo de token de debug
const tokenFile = path.join(__dirname, 'admin-token-debug.json');

console.log('=== Verificación de Token de Admin ===\n');

if (fs.existsSync(tokenFile)) {
  try {
    const tokenData = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
    console.log('✅ Archivo de token encontrado');
    console.log('Token timestamp:', new Date(tokenData.timestamp).toLocaleString());
    console.log('Token (primeros 50 chars):', tokenData.adminToken.substring(0, 50) + '...');
    
    // Verificar si el token es válido
    const axios = require('axios');
    
    async function verifyToken() {
      try {
        const response = await axios.get('http://localhost:3001/api/admin/dashboard', {
          headers: {
            'Authorization': `Bearer ${tokenData.adminToken}`
          }
        });
        
        console.log('\n✅ Token válido - Status:', response.status);
        console.log('✅ Dashboard accesible');
        
        // Ahora verificar pagos
        const paymentsResponse = await axios.get('http://localhost:3001/api/admin/payments', {
          headers: {
            'Authorization': `Bearer ${tokenData.adminToken}`
          }
        });
        
        console.log('✅ Pagos accesibles - Status:', paymentsResponse.status);
        console.log('✅ Total pagos:', paymentsResponse.data.data.payments.length);
        
      } catch (error) {
        console.log('\n❌ Token inválido o expirado');
        console.log('Error:', error.response?.status, error.response?.data?.message || error.message);
      }
    }
    
    verifyToken();
    
  } catch (error) {
    console.log('❌ Error leyendo archivo de token:', error.message);
  }
} else {
  console.log('❌ No se encontró archivo de token de debug');
  console.log('\n📝 Instrucciones para el usuario:');
  console.log('1. Abrir el admin panel en el navegador');
  console.log('2. Hacer login con admin@jooru.com / Admin123!');
  console.log('3. Abrir DevTools (F12)');
  console.log('4. En la consola, ejecutar: localStorage.getItem("adminToken")');
  console.log('5. Si no hay token, el usuario no está logueado');
}