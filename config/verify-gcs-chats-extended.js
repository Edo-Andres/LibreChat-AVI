const path = require('path');
const { Storage } = require('@google-cloud/storage');
const dotenv = require('dotenv');

// Cargar variables de entorno desde el .env principal (raíz del repo)
dotenv.config({ path: path.join(__dirname, '../.env') });

function getDateUTC() {
  // YYYY-MM-DD en UTC
  return new Date().toISOString().slice(0, 10);
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
  // Busca con prefijo de carpeta y filtra por fecha en el nombre del archivo
  // Cubre tanto "chats_extended_DATE_" como "chats_chats_extended_DATE_" (nombre legacy)
  const folderPrefix = bucketPath;
  const datePattern = `chats_extended_${dateUTC}_`;

  console.log('🔎 Verificando existencia de archivo en GCS...');
  console.log(`   📅 Fecha UTC: ${dateUTC}`);
  console.log(`   ☁️  Bucket: ${bucketName}`);
  console.log(`   📁 Carpeta: ${folderPrefix}`);
  console.log(`   🔍 Patrón buscado: *${datePattern}*`);

  const storage = getGCSClient();

  const [files] = await storage.bucket(bucketName).getFiles({ prefix: folderPrefix });

  // Filtrar archivos que contengan el patrón de fecha en su nombre
  const matchingFiles = (files || []).filter((f) => f.name.includes(datePattern));

  if (matchingFiles.length === 0) {
    console.error(`❌ No se encontró ningún archivo con patrón "${datePattern}" en: gs://${bucketName}/${folderPrefix}`);
    // Mostrar archivos existentes en la carpeta para ayudar al diagnóstico
    if (files && files.length > 0) {
      console.log(`   ℹ️  Archivos existentes en la carpeta (últimos 5):`);
      files.slice(-5).forEach((f) => console.log(`      - ${f.name}`));
    }
    return { exists: false, bucketName, prefix: folderPrefix, matches: [] };
  }

  console.log(`✅ Encontrado(s) ${matchingFiles.length} archivo(s) para el día (UTC).`);
  matchingFiles.slice(0, 10).forEach((f) => console.log(`   - ${f.name}`));

  return { exists: true, bucketName, prefix: folderPrefix, matches: matchingFiles.map((f) => f.name) };
}

async function main() {
  try {
    const result = await verifyTodayFileExists();
    process.exit(result.exists ? 0 : 2);
  } catch (error) {
    console.error(`❌ Error verificando GCS: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { verifyTodayFileExists };
