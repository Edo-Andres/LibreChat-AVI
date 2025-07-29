const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno desde el archivo .env principal
dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  baseUrl: process.env.HEALTH_CHECK_URL,
  email: process.env.HEALTH_CHECK_EMAIL,
  password: process.env.HEALTH_CHECK_PASSWORD,
  agentId: process.env.HEALTH_CHECK_AGENT_ID,
  adminEmail: process.env.HEALTH_CHECK_ADMIN_EMAIL,
  appTitle: process.env.APP_TITLE || 'LibreChat'
};

// Validar configuración
function validateConfig() {
  const required = ['baseUrl', 'email', 'password', 'agentId'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`❌ Variables faltantes: ${missing.join(', ')}`);
  }
  
  console.log('✅ Configuración validada:');
  console.log(`   🌐 URL: ${config.baseUrl}`);
  console.log(`   👤 Usuario: ${config.email}`);
  console.log(`   🤖 Agente: ${config.agentId}`);
  console.log(`   📧 Admin: ${config.adminEmail}`);
  console.log('');
}

module.exports = { config, validateConfig }; 