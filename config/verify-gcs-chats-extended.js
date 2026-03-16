const path = require('path');
const { Storage } = require('@google-cloud/storage');
const dotenv = require('dotenv');
const EmailNotifier = require('./services/email-notifier');

// Cargar variables de entorno desde el .env principal (raíz del repo)
dotenv.config({ path: path.join(__dirname, '../.env') });

function getDateUTC() {
  // YYYY-MM-DD en UTC
  return new Date().toISOString().slice(0, 10);
}

function parseAdminEmails(emailString) {
  if (!emailString) {
    return { success: null, error: null, all: [] };
  }

  const emails = emailString
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  return {
    success: emails[0] || null,
    error: emails.slice(0, 2).join(', ') || null,
    all: emails,
  };
}

function normalizeBucketPath(bucketPath) {
  if (!bucketPath) {
    return '';
  }
  return bucketPath.endsWith('/') ? bucketPath : `${bucketPath}/`;
}

function getGCSClient() {
  const googleCredentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;

  if (!googleCredentialsJson) {
    throw new Error('❌ Variable GOOGLE_CREDENTIALS_JSON no encontrada en .env');
  }

  let credentials;
  try {
    credentials = JSON.parse(googleCredentialsJson);
  } catch (error) {
    throw new Error(`❌ Error parseando GOOGLE_CREDENTIALS_JSON: ${error.message}`);
  }

  return new Storage({ credentials });
}

async function verifyTodayFileExists() {
  // Defaults alineados con config/upload-to-gcs-extended.js
  const bucketName = process.env.GCS_BUCKET_NAME || 'avi-bkt';
  const bucketPath = normalizeBucketPath(process.env.GCS_BUCKET_PATH || 'chats/');

  const dateUTC = getDateUTC();
  // La validación debe buscar el token de fecha UTC dentro del nombre del archivo.
  const dateToken = `_${dateUTC}_`;
  const folderPrefix = bucketPath;

  console.log('🔎 Verificando existencia de archivo en GCS...');
  console.log(`   📅 Fecha UTC: ${dateUTC}`);
  console.log(`   ☁️  Bucket: ${bucketName}`);
  console.log(`   📁 Carpeta: ${folderPrefix}`);
  console.log(`   🔍 Token buscado en nombre: *${dateToken}*`);

  const storage = getGCSClient();

  const [files] = await storage.bucket(bucketName).getFiles({ prefix: folderPrefix });

  // Filtrar por token de fecha en cualquier parte del nombre del archivo.
  const matchingFiles = (files || []).filter((f) => f.name.includes(dateToken));

  if (matchingFiles.length === 0) {
    console.error(`❌ No se encontró ningún archivo con token "${dateToken}" en: gs://${bucketName}/${folderPrefix}`);
    // Mostrar archivos existentes en la carpeta para ayudar al diagnóstico
    if (files && files.length > 0) {
      console.log(`   ℹ️  Archivos existentes en la carpeta (últimos 5):`);
      files.slice(-5).forEach((f) => console.log(`      - ${f.name}`));
    }
    return {
      exists: false,
      bucketName,
      prefix: folderPrefix,
      dateUTC,
      dateToken,
      scannedCount: files?.length || 0,
      recentFiles: (files || []).slice(-5).map((f) => f.name),
      matches: [],
    };
  }

  console.log(`✅ Encontrado(s) ${matchingFiles.length} archivo(s) para el día (UTC).`);
  matchingFiles.slice(0, 10).forEach((f) => console.log(`   - ${f.name}`));

  return {
    exists: true,
    bucketName,
    prefix: folderPrefix,
    dateUTC,
    dateToken,
    scannedCount: files?.length || 0,
    recentFiles: [],
    matches: matchingFiles.map((f) => f.name),
  };
}

async function sendVerificationEmail({ isSuccess, result, errorMessage, durationMs }) {
  const adminEmails = parseAdminEmails(process.env.HEALTH_CHECK_ADMIN_EMAIL);
  const recipients = isSuccess ? adminEmails.success : adminEmails.error;

  if (!recipients) {
    console.warn('⚠️ No hay destinatarios configurados en HEALTH_CHECK_ADMIN_EMAIL. Se omite envío de email.');
    return;
  }

  const emailNotifier = new EmailNotifier();

  const subject = isSuccess
    ? '✅ Respaldo programado OK: limpieza + exportacion a GCS'
    : '❌ Respaldo programado fallido: cleanup/sync GCS';

  const testResults = {
    success: isSuccess,
    duration: durationMs,
    steps: {
      config: true,
      login: false,
      loadData: false,
      sendMessage: false,
    },
    details: {
      verificationType: 'gcs-chats-extended-date-token',
      dateUTC: result?.dateUTC || getDateUTC(),
      dateToken: result?.dateToken || `_${getDateUTC()}_`,
      bucketName: result?.bucketName || process.env.GCS_BUCKET_NAME || 'avi-bkt',
      folderPrefix: result?.prefix || normalizeBucketPath(process.env.GCS_BUCKET_PATH || 'chats/'),
      scannedCount: result?.scannedCount || 0,
      matchCount: result?.matches?.length || 0,
      matches: result?.matches || [],
      recentFiles: result?.recentFiles || [],
      error: errorMessage || null,
    },
  };

  const emailData = {
    subject,
    isSuccess,
    testResults,
    config: {
      baseUrl: process.env.HEALTH_CHECK_URL || process.env.DOMAIN_CLIENT || 'N/A',
      email: process.env.HEALTH_CHECK_EMAIL || 'N/A',
      agentId: process.env.HEALTH_CHECK_AGENT_ID || 'N/A',
      appTitle: process.env.APP_TITLE || 'LibreChat',
    },
    notificationType: 'gcs-backup-verify',
    error: errorMessage || undefined,
  };

  await emailNotifier.sendNotification(emailData, recipients);
}

async function main() {
  const startTime = Date.now();

  try {
    const result = await verifyTodayFileExists();
    await sendVerificationEmail({
      isSuccess: result.exists,
      result,
      errorMessage: result.exists ? null : `No se encontró archivo para la fecha UTC ${result.dateUTC}`,
      durationMs: Date.now() - startTime,
    });
    process.exit(result.exists ? 0 : 2);
  } catch (error) {
    console.error(`❌ Error verificando GCS: ${error.message}`);
    try {
      await sendVerificationEmail({
        isSuccess: false,
        result: null,
        errorMessage: error.message,
        durationMs: Date.now() - startTime,
      });
    } catch (emailError) {
      console.error(`❌ Error enviando email de verificación: ${emailError.message}`);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { verifyTodayFileExists };
