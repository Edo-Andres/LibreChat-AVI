const axios = require('axios');
const { sendEmail } = require('../api/server/utils/sendEmail');
const { checkEmailConfig } = require('../api/server/utils');

const HEALTH_CHECK_CONFIG = {
  baseUrl: process.env.HEALTH_CHECK_URL || 'https://avi.corporacionccm.cl',
  email: process.env.HEALTH_CHECK_EMAIL || 'echev.test1@gmail.com', 
  password: process.env.HEALTH_CHECK_PASSWORD || '12341234',
  agentId: process.env.HEALTH_CHECK_AGENT_ID || 'agent_nC338LEca541Mt80BSC0i',
  adminEmail: process.env.HEALTH_CHECK_ADMIN_EMAIL || 'asistente@corporacionccm.cl'
};

async function dailyHealthCheck() {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Iniciando Health Check diario...');
    console.log(`📅 Fecha: ${new Date().toISOString()}`);
    console.log(`🌐 URL: ${HEALTH_CHECK_CONFIG.baseUrl}`);
    console.log(`🤖 Agente: ${HEALTH_CHECK_CONFIG.agentId}`);
    
    // 1. Login
    const loginResponse = await login();
    const token = loginResponse.token;
    console.log('✅ Login exitoso');
    
    // 2. Enviar mensaje de test  
    const chatResponse = await sendTestMessage(token);
    console.log('✅ Mensaje enviado exitosamente');
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Health Check completado en ${totalTime}ms`);
    
    // 3. Enviar email de éxito
    await sendSuccessNotification(totalTime);
    
  } catch (error) {
    console.error('❌ Health Check falló:', error.message);
    await sendErrorNotification(error);
    process.exit(1);
  }
}

async function login() {
  try {
    const response = await axios.post(`${HEALTH_CHECK_CONFIG.baseUrl}/api/auth/login`, {
      email: HEALTH_CHECK_CONFIG.email,
      password: HEALTH_CHECK_CONFIG.password,
    }, {
      timeout: 30000, // 30 segundos timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LibreChat-HealthCheck/1.0'
      }
    });
    
    if (response.status !== 200 || !response.data.token) {
      throw new Error(`Login falló con status ${response.status}: ${response.data?.message || 'Token no recibido'}`);
    }
    
    return response.data;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Timeout en login - Servidor no responde');
    }
    if (error.response) {
      throw new Error(`Login falló: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`);
    }
    throw new Error(`Error de conexión en login: ${error.message}`);
  }
}

async function sendTestMessage(token) {
  try {
    const payload = {
      text: 'mensaje test diario, responde test ok',
      sender: 'User',
      clientTimestamp: new Date().toISOString(),
      isCreatedByUser: true,
      parentMessageId: '00000000-0000-0000-0000-000000000000',
      messageId: generateUUID(),
      error: false,
      generation: '',
      endpoint: 'agents',
      agent_id: HEALTH_CHECK_CONFIG.agentId,
      key: new Date().toISOString(),
      isContinued: false,
      isTemporary: false
    };

    const response = await axios.post(`${HEALTH_CHECK_CONFIG.baseUrl}/api/agents/chat`, payload, {
      timeout: 60000, // 60 segundos timeout para chat
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'LibreChat-HealthCheck/1.0'
      }
    });
    
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Chat falló con status ${response.status}: ${response.data?.message || response.statusText}`);
    }
    
    return response.data;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Timeout en chat - Agente no responde en tiempo esperado');
    }
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.response.statusText;
      
      if (status === 429) {
        throw new Error(`Rate limit alcanzado (429): ${message} - API temporalmente no disponible`);
      }
      throw new Error(`Chat falló: ${status} - ${message}`);
    }
    throw new Error(`Error de conexión en chat: ${error.message}`);
  }
}

async function sendSuccessNotification(responseTime) {
  if (!checkEmailConfig() || !HEALTH_CHECK_CONFIG.adminEmail) {
    console.log('⚠️ Configuración de email no disponible para notificaciones');
    return;
  }
  
  try {
    await sendEmail({
      email: HEALTH_CHECK_CONFIG.adminEmail,
      subject: '✅ LibreChat Health Check - Test Diario Exitoso',
      payload: {
        appName: process.env.APP_TITLE || 'LibreChat',
        url: HEALTH_CHECK_CONFIG.baseUrl,
        timestamp: new Date().toLocaleString('es-CL', {
          timeZone: 'America/Santiago',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        agentId: HEALTH_CHECK_CONFIG.agentId,
        responseTime: responseTime,
        year: new Date().getFullYear()
      },
      template: 'healthCheckSuccess.handlebars',
    });
    console.log('📧 Email de éxito enviado a:', HEALTH_CHECK_CONFIG.adminEmail);
  } catch (emailError) {
    console.error('❌ Error enviando email de éxito:', emailError.message);
  }
}

async function sendErrorNotification(error) {
  if (!checkEmailConfig() || !HEALTH_CHECK_CONFIG.adminEmail) {
    console.log('⚠️ Configuración de email no disponible para notificaciones');
    return;
  }
  
  try {
    await sendEmail({
      email: HEALTH_CHECK_CONFIG.adminEmail,
      subject: '🚨 LibreChat Health Check - Error Detectado',
      payload: {
        appName: process.env.APP_TITLE || 'LibreChat',
        errorMessage: error.message,
        timestamp: new Date().toLocaleString('es-CL', {
          timeZone: 'America/Santiago',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        url: HEALTH_CHECK_CONFIG.baseUrl,
        agentId: HEALTH_CHECK_CONFIG.agentId,
        year: new Date().getFullYear()
      },
      template: 'healthCheckError.handlebars',
    });
    console.log('📧 Email de error enviado a:', HEALTH_CHECK_CONFIG.adminEmail);
  } catch (emailError) {
    console.error('❌ Error enviando email de error:', emailError.message);
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  dailyHealthCheck();
}

module.exports = dailyHealthCheck; 