const axios = require('axios');
const fs = require('fs');

async function checkUsersCount() {
  try {
    console.log('=== Verificación de usuarios en API ===\n');
    
    const tokenData = JSON.parse(fs.readFileSync('admin-token-debug.json', 'utf8'));
    const response = await axios.get('http://localhost:3001/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${tokenData.adminToken}`
      }
    });
    
    console.log('✅ Status:', response.status);
    console.log('✅ Success:', response.data.success);
    console.log('✅ Total usuarios en API:', response.data.message.users.length);
    
    console.log('\n📋 Primeros 5 usuarios:');
    response.data.message.users.slice(0, 5).forEach((user, i) => {
      console.log(`${i+1}. ${user.profile?.firstName || 'N/A'} ${user.profile?.lastName || 'N/A'} - ${user.email}`);
    });
    
    if (response.data.message.users.length > 10) {
      console.log('\n📋 Últimos 3 usuarios:');
      response.data.message.users.slice(-3).forEach((user, i) => {
        const index = response.data.message.users.length - 3 + i + 1;
        console.log(`${index}. ${user.profile?.firstName || 'N/A'} ${user.profile?.lastName || 'N/A'} - ${user.email}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

checkUsersCount();