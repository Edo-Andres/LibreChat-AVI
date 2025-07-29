const { config, validateConfig } = require('./load-config');
const EmailNotifier = require('../services/email-notifier');

async function testEmailConfiguration() {
  console.log('🧪 Iniciando test de configuración de email...');
  
  try {
    // Validar configuración básica
    validateConfig();
    
    // Crear instancia del notificador
    const emailNotifier = new EmailNotifier();
    
    console.log('📧 Enviando email de prueba...');
    
    // Simular resultados de prueba exitosos
    const testResults = {
      success: true,
      duration: 1500,
      steps: {
        config: true,
        login: true,
        loadData: true,
        sendMessage: true
      },
      details: {
        configStatus: 200,
        bannerStatus: 200,
        loginStatus: 200,
        userDataStatus: 200,
        agentsDataStatus: 200,
        messageStatus: 200,
        responseSize: 2340
      }
    };
    
    // Preparar datos del email de prueba
    const emailData = {
      subject: '🧪 Test Email - Health Check LibreChat AVI',
      isSuccess: true,
      testResults: testResults,
      config: config
    };
    
    // Enviar email de prueba
    await emailNotifier.sendNotification(emailData);
    
    console.log('✅ Email de prueba enviado exitosamente');
    console.log(`📧 Destinatario: ${config.adminEmail}`);
    console.log('🎉 Configuración de email validada correctamente');
    
  } catch (error) {
    console.error('❌ Error en test de email:', error.message);
    console.error('');
    console.error('🔍 Posibles causas:');
    console.error('   - Variables EMAIL_* no configuradas correctamente');
    console.error('   - Credenciales de email incorrectas');
    console.error('   - Configuración SMTP incorrecta');
    console.error('   - Firewall bloqueando conexión SMTP');
    console.error('');
    console.error('💡 Verifica las variables de entorno:');
    console.error('   - EMAIL_HOST, EMAIL_PORT, EMAIL_SERVICE');
    console.error('   - EMAIL_USERNAME, EMAIL_PASSWORD');
    console.error('   - EMAIL_FROM, EMAIL_FROM_NAME');
    console.error('   - HEALTH_CHECK_ADMIN_EMAIL');
    
    process.exit(1);
  }
}

// Ejecutar test si es llamado directamente
if (require.main === module) {
  testEmailConfiguration();
}

module.exports = testEmailConfiguration; 