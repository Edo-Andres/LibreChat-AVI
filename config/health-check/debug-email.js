const nodemailer = require('nodemailer');

console.log('🔍 Debug Email Configuration...');

// Verificar variables de entorno
console.log('\n📋 Variables de entorno:');
console.log('EMAIL_SERVICE:', process.env.EMAIL_SERVICE);
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_ENCRYPTION:', process.env.EMAIL_ENCRYPTION);
console.log('EMAIL_USERNAME:', process.env.EMAIL_USERNAME ? '***configurado***' : 'NO CONFIGURADO');
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '***configurado***' : 'NO CONFIGURADO');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM);
console.log('EMAIL_FROM_NAME:', process.env.EMAIL_FROM_NAME);
console.log('EMAIL_ALLOW_SELFSIGNED:', process.env.EMAIL_ALLOW_SELFSIGNED);

// Verificar nodemailer
console.log('\n📦 Verificando nodemailer:');
console.log('nodemailer version:', require('nodemailer/package.json').version);
console.log('createTransport disponible:', typeof nodemailer.createTransport);

// Intentar crear transporter básico
console.log('\n⚙️ Creando transporter...');

const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_ENCRYPTION === 'ssl',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
};

if (process.env.EMAIL_SERVICE === 'gmail') {
  emailConfig.service = 'gmail';
}

console.log('Config (sin passwords):', {
  ...emailConfig,
  auth: {
    user: emailConfig.auth.user,
    pass: emailConfig.auth.pass ? '***configurado***' : 'NO CONFIGURADO',
  },
});

try {
  const transporter = nodemailer.createTransporter(emailConfig);
  console.log('✅ Transporter creado exitosamente');

  // Verificar conexión
  console.log('\n🔗 Verificando conexión SMTP...');
  transporter.verify((error, success) => {
    if (error) {
      console.log('❌ Error de conexión SMTP:', error.message);
    } else {
      console.log('✅ Conexión SMTP exitosa');
    }
  });
} catch (error) {
  console.log('❌ Error creando transporter:', error.message);
}
