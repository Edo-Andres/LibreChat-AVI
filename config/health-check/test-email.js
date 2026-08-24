const { config, validateConfig } = require('./load-config');
const EmailNotifier = require('../services/email-notifier');

async function testEmailConfiguration() {
  console.log('🧪 Iniciando test de configuración de email...');

  try {
    // Validar configuración básica
    validateConfig();

    // Mostrar parseo de emails
    console.log('📧 Configuración de emails parseada:');
    console.log(`   📧 Original: ${config.adminEmail}`);
    console.log(`   ✅ Para éxito: ${config.adminEmailSuccess}`);
    console.log(`   ❌ Para error: ${config.adminEmailError}`);
    console.log(`   📋 Lista completa: [${config.adminEmailsList.join(', ')}]`);
    console.log('');

    // Crear instancia del notificador
    const emailNotifier = new EmailNotifier();

    console.log('📧 Enviando email de prueba de ÉXITO...');

    // Simular resultados de prueba exitosos
    const testResults = {
      success: true,
      duration: 1500,
      steps: {
        config: true,
        login: true,
        loadData: true,
        sendMessage: true,
      },
      details: {
        configStatus: 200,
        bannerStatus: 200,
        loginStatus: 200,
        userDataStatus: 200,
        agentsDataStatus: 200,
        messageStatus: 200,
        responseSize: 2340,
      },
    };

    // Test de email de éxito (solo primer destinatario)
    const successEmailData = {
      subject: '🧪 Test Email ÉXITO - Health Check LibreChat AVI',
      isSuccess: true,
      testResults: testResults,
      config: config,
    };

    // Enviar email de éxito con destinatario específico
    await emailNotifier.sendNotification(successEmailData, config.adminEmailSuccess);

    console.log('✅ Email de prueba de ÉXITO enviado exitosamente');
    console.log(`📧 Destinatario (éxito): ${config.adminEmailSuccess}`);
    console.log('');

    // Test de email de error (todos los destinatarios)
    console.log('📧 Enviando email de prueba de ERROR...');

    const errorEmailData = {
      subject: '🧪 Test Email ERROR - Health Check LibreChat AVI',
      isSuccess: false,
      testResults: { ...testResults, success: false, error: 'Test simulado de error' },
      config: config,
      error: 'Error simulado para prueba de notificación',
    };

    // Enviar email de error con todos los destinatarios
    await emailNotifier.sendNotification(errorEmailData, config.adminEmailError);

    console.log('✅ Email de prueba de ERROR enviado exitosamente');
    console.log(`📧 Destinatarios (error): ${config.adminEmailError}`);
    console.log('');
    console.log('🎉 Configuración de email validada correctamente');
    console.log('🎯 Se enviaron 2 emails de prueba: uno de éxito y uno de error');
  } catch (error) {
    console.error('❌ Error en test de email:', error.message);
    console.error('');
    console.error('🔍 Posibles causas:');
    console.error('   1. Variables EMAIL_* no configuradas correctamente');
    console.error('   2. Credenciales de Gmail incorrectas (usar App Password)');
    console.error('   3. Variables HEALTH_CHECK_* faltantes');
    console.error('   4. Problemas de conectividad SMTP');
    console.error('');
    console.error('💡 Revisar la configuración en .env y README_HEALTH_CHECK_AUDIT.md');

    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testEmailConfiguration();
}

module.exports = testEmailConfiguration;
