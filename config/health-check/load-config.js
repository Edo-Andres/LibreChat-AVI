const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno desde el archivo .env principal
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Función para parsear emails de administrador
function parseAdminEmails(emailString) {
  if (!emailString) {
    return {
      success: null,
      error: null,
      all: [],
    };
  }

  // Split por comas y limpiar espacios
  const emails = emailString
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  return {
    success: emails[0] || null, // Primer email para notificaciones de éxito
    error: emails.join(', '), // Todos los emails para notificaciones de error
    all: emails, // Array completo para referencia
  };
}

const adminEmails = parseAdminEmails(process.env.HEALTH_CHECK_ADMIN_EMAIL);

const config = {
  baseUrl: process.env.HEALTH_CHECK_URL,
  email: process.env.HEALTH_CHECK_EMAIL,
  password: process.env.HEALTH_CHECK_PASSWORD,
  agentId: process.env.HEALTH_CHECK_AGENT_ID,
  adminEmail: process.env.HEALTH_CHECK_ADMIN_EMAIL, // Mantener original para compatibilidad
  adminEmailSuccess: adminEmails.success, // Solo primer email
  adminEmailError: adminEmails.error, // Todos los emails
  adminEmailsList: adminEmails.all, // Array para referencia
  appTitle: process.env.APP_TITLE || 'LibreChat',
};

// Validar configuración
function validateConfig() {
  const required = ['baseUrl', 'email', 'password', 'agentId'];
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(`❌ Variables faltantes: ${missing.join(', ')}`);
  }

  console.log('✅ Configuración validada:');
  console.log(`   🌐 URL: ${config.baseUrl}`);
  console.log(`   👤 Usuario: ${config.email}`);
  console.log(`   🤖 Agente: ${config.agentId}`);
  console.log(`   📧 Admin (todos): ${config.adminEmail}`);
  console.log(`   📧 Admin (éxito): ${config.adminEmailSuccess}`);
  console.log(`   📧 Admin (error): ${config.adminEmailError}`);
  console.log('');
}

module.exports = { config, validateConfig, parseAdminEmails };
