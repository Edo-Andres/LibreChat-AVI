const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
require('dotenv').config();

// ⭐ CONFIGURACIÓN GCS (leída de variables de entorno, fallback a defaults)
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'avi-bkt';

function normalizeBucketPath(bucketPath) {
  if (!bucketPath) {
    return '';
  }
  return bucketPath.endsWith('/') ? bucketPath : `${bucketPath}/`;
}

const BUCKET_PATH = normalizeBucketPath(process.env.GCS_BUCKET_PATH || 'chats/');
const CSV_FILE = path.join(__dirname, '..', 'api', 'chats_extended.csv');

/**
 * Obtiene credenciales desde variable de entorno y crea cliente GCS
 */
function getGCSClient() {
  const googleCredentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;

  if (!googleCredentialsJson) {
    throw new Error('❌ Variable GOOGLE_CREDENTIALS_JSON no encontrada en .env');
  }

  try {
    const credentials = JSON.parse(googleCredentialsJson);
    console.log('🔒 Usando credenciales desde variable de entorno (.env)');

    const storage = new Storage({ credentials });
    return storage;
  } catch (error) {
    throw new Error(`❌ Error parseando GOOGLE_CREDENTIALS_JSON: ${error.message}`);
  }
}

/**
 * Genera nombre de archivo con timestamp
 * Formato: chats_extended_2026-02-19_143022.csv
 */
function generateFileName() {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // 2026-02-19
  const time = now.toTimeString().split(' ')[0].replace(/:/g, ''); // 143022
  return `chats_extended_${date}_${time}.csv`;
}

/**
 * Valida que el archivo CSV existe
 */
function validateCSVExists() {
  if (!fs.existsSync(CSV_FILE)) {
    throw new Error(`❌ Archivo no encontrado: ${CSV_FILE}`);
  }
  
  const stats = fs.statSync(CSV_FILE);
  const sizeKB = (stats.size / 1024).toFixed(2);
  console.log(`📊 Archivo encontrado: ${sizeKB} KB`);
  
  return stats;
}

/**
 * Sube archivo a Google Cloud Storage
 */
async function uploadToGCS() {
  try {
    const storage = getGCSClient();
    const stats = validateCSVExists();
    
    const fileName = generateFileName();
    const destination = `${BUCKET_PATH}${fileName}`;
    
    console.log(`📤 Subiendo a GCS: gs://${BUCKET_NAME}/${destination}`);
    
    await storage.bucket(BUCKET_NAME).upload(CSV_FILE, {
      destination: destination,
      metadata: {
        contentType: 'text/csv',
        metadata: {
          uploadedAt: new Date().toISOString(),
          source: 'LibreChat-AVI',
          exportType: 'extended'
        }
      }
    });

    console.log(`✅ Archivo subido exitosamente!`);
    console.log(`   📍 Ubicación: gs://${BUCKET_NAME}/${destination}`);
    console.log(`   📏 Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
    
    return { bucket: BUCKET_NAME, path: destination, size: stats.size };

  } catch (error) {
    throw new Error(`❌ Error subiendo a GCS: ${error.message}`);
  }
}

/**
 * Elimina archivo CSV local
 */
function cleanupFile() {
  try {
    if (fs.existsSync(CSV_FILE)) {
      fs.unlinkSync(CSV_FILE);
      console.log('🧹 Archivo local eliminado');
    }
  } catch (error) {
    console.warn(`⚠️ No se pudo eliminar archivo local: ${error.message}`);
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 Iniciando upload a Google Cloud Storage...');
    console.log(`   Bucket: ${BUCKET_NAME}`);
    console.log(`   Path: ${BUCKET_PATH}`);

    // Subir a GCS
    const result = await uploadToGCS();

    // Limpiar archivo local
    cleanupFile();

    console.log('✅ Proceso completado exitosamente!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error en el proceso:', error.message);
    
    // Si falla, NO eliminar el archivo para debug
    console.warn('⚠️ Archivo local preservado para debugging');
    
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { main, uploadToGCS, cleanupFile };
