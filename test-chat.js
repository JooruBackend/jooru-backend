/**
 * Script de prueba para el sistema de chat y notificaciones
 * Este archivo demuestra cómo probar las funcionalidades implementadas
 */

const io = require('socket.io-client');
const axios = require('axios');

// Configuración
const SERVER_URL = 'http://localhost:3000';
const API_BASE = `${SERVER_URL}/api`;

// Tokens de prueba (debes obtenerlos del login)
const USER_TOKEN_1 = 'tu_token_usuario_1';
const USER_TOKEN_2 = 'tu_token_usuario_2';

/**
 * 1. PRUEBA DE CONEXIÓN WEBSOCKET
 */
function testWebSocketConnection() {
  console.log('\n=== PRUEBA DE CONEXIÓN WEBSOCKET ===');
  
  const socket = io(SERVER_URL, {
    auth: {
      token: USER_TOKEN_1
    }
  });

  socket.on('connect', () => {
    console.log('✅ Conectado al servidor WebSocket');
    console.log('Socket ID:', socket.id);
  });

  socket.on('user_connected', (data) => {
    console.log('👤 Usuario conectado:', data);
  });

  socket.on('new_message', (message) => {
    console.log('💬 Nuevo mensaje recibido:', message);
  });

  socket.on('message_read', (data) => {
    console.log('👁️ Mensaje leído:', data);
  });

  socket.on('user_typing', (data) => {
    console.log('⌨️ Usuario escribiendo:', data);
  });

  socket.on('disconnect', () => {
    console.log('❌ Desconectado del servidor');
  });

  return socket;
}

/**
 * 2. PRUEBA DE API REST - CREAR CHAT
 */
async function testCreateChat() {
  console.log('\n=== PRUEBA DE CREACIÓN DE CHAT ===');
  
  try {
    const response = await axios.post(`${API_BASE}/chat`, {
      serviceRequestId: '507f1f77bcf86cd799439011', // ID de ejemplo
      type: 'service'
    }, {
      headers: {
        'Authorization': `Bearer ${USER_TOKEN_1}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Chat creado exitosamente:');
    console.log('Chat ID:', response.data.data._id);
    console.log('Participantes:', response.data.data.participants.length);
    
    return response.data.data._id;
  } catch (error) {
    console.error('❌ Error al crear chat:', error.response?.data || error.message);
    return null;
  }
}

/**
 * 3. PRUEBA DE ENVÍO DE MENSAJES
 */
async function testSendMessage(chatId, socket) {
  console.log('\n=== PRUEBA DE ENVÍO DE MENSAJES ===');
  
  if (!chatId) {
    console.log('❌ No hay chat ID disponible');
    return;
  }

  try {
    // Enviar mensaje de texto
    const response = await axios.post(`${API_BASE}/chat/${chatId}/messages`, {
      type: 'text',
      content: {
        text: '¡Hola! Este es un mensaje de prueba del sistema de chat.'
      }
    }, {
      headers: {
        'Authorization': `Bearer ${USER_TOKEN_1}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Mensaje enviado exitosamente:');
    console.log('Mensaje ID:', response.data.data._id);
    console.log('Contenido:', response.data.data.content.text);
    
    // Simular evento de escritura via WebSocket
    if (socket) {
      socket.emit('typing_start', { chatId });
      setTimeout(() => {
        socket.emit('typing_stop', { chatId });
      }, 2000);
    }
    
    return response.data.data._id;
  } catch (error) {
    console.error('❌ Error al enviar mensaje:', error.response?.data || error.message);
    return null;
  }
}

/**
 * 4. PRUEBA DE LECTURA DE MENSAJES
 */
async function testReadMessages(chatId, messageId) {
  console.log('\n=== PRUEBA DE LECTURA DE MENSAJES ===');
  
  if (!chatId || !messageId) {
    console.log('❌ No hay chat ID o message ID disponible');
    return;
  }

  try {
    const response = await axios.post(`${API_BASE}/chat/${chatId}/read`, {
      messageId: messageId
    }, {
      headers: {
        'Authorization': `Bearer ${USER_TOKEN_2}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Mensaje marcado como leído exitosamente');
    console.log('Mensajes leídos:', response.data.data.readCount);
  } catch (error) {
    console.error('❌ Error al marcar mensaje como leído:', error.response?.data || error.message);
  }
}

/**
 * 5. PRUEBA DE OBTENER CHATS DEL USUARIO
 */
async function testGetUserChats() {
  console.log('\n=== PRUEBA DE OBTENER CHATS DEL USUARIO ===');
  
  try {
    const response = await axios.get(`${API_BASE}/chat`, {
      headers: {
        'Authorization': `Bearer ${USER_TOKEN_1}`
      }
    });
    
    console.log('✅ Chats obtenidos exitosamente:');
    console.log('Total de chats:', response.data.data.length);
    response.data.data.forEach((chat, index) => {
      console.log(`Chat ${index + 1}:`, {
        id: chat._id,
        tipo: chat.type,
        participantes: chat.participantCount,
        ultimoMensaje: chat.lastMessage?.content || 'Sin mensajes',
        noLeidos: chat.unreadCount || 0
      });
    });
  } catch (error) {
    console.error('❌ Error al obtener chats:', error.response?.data || error.message);
  }
}

/**
 * 6. PRUEBA DE NOTIFICACIONES
 */
async function testNotifications() {
  console.log('\n=== PRUEBA DE NOTIFICACIONES ===');
  
  try {
    const response = await axios.get(`${API_BASE}/notifications`, {
      headers: {
        'Authorization': `Bearer ${USER_TOKEN_1}`
      }
    });
    
    console.log('✅ Notificaciones obtenidas exitosamente:');
    console.log('Total de notificaciones:', response.data.data.length);
    response.data.data.slice(0, 3).forEach((notification, index) => {
      console.log(`Notificación ${index + 1}:`, {
        tipo: notification.type,
        titulo: notification.title,
        leida: notification.read,
        fecha: new Date(notification.createdAt).toLocaleString()
      });
    });
  } catch (error) {
    console.error('❌ Error al obtener notificaciones:', error.response?.data || error.message);
  }
}

/**
 * FUNCIÓN PRINCIPAL DE PRUEBA
 */
async function runTests() {
  console.log('🚀 INICIANDO PRUEBAS DEL SISTEMA DE CHAT Y NOTIFICACIONES');
  console.log('='.repeat(60));
  
  // Verificar que los tokens estén configurados
  if (USER_TOKEN_1 === 'tu_token_usuario_1' || USER_TOKEN_2 === 'tu_token_usuario_2') {
    console.log('⚠️ IMPORTANTE: Debes configurar los tokens de usuario reales');
    console.log('1. Inicia el servidor: npm start');
    console.log('2. Registra/inicia sesión con dos usuarios diferentes');
    console.log('3. Copia los tokens JWT y reemplázalos en este archivo');
    console.log('4. Ejecuta este script nuevamente: node test-chat.js');
    return;
  }
  
  // Conectar WebSocket
  const socket = testWebSocketConnection();
  
  // Esperar un poco para la conexión
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Ejecutar pruebas secuencialmente
  const chatId = await testCreateChat();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const messageId = await testSendMessage(chatId, socket);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testReadMessages(chatId, messageId);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testGetUserChats();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testNotifications();
  
  console.log('\n✅ PRUEBAS COMPLETADAS');
  console.log('='.repeat(60));
  
  // Cerrar conexión
  socket.disconnect();
}

// Ejecutar pruebas si el archivo se ejecuta directamente
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testWebSocketConnection,
  testCreateChat,
  testSendMessage,
  testReadMessages,
  testGetUserChats,
  testNotifications,
  runTests
};