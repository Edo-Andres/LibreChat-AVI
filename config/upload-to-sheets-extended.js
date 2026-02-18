const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { google } = require('googleapis');
require('dotenv').config();

// ⭐ CONFIGURACIÓN PARA SHEET EXTENDIDO
const SPREADSHEET_ID = '1Johw_83AhQU-bMwL36x9CV8q1yTwhxsojiBkAMkMh2U';
const RANGE_NAME = 'Hoja 1'; // ⭐ NUEVA HOJA
const CSV_FILE = path.join(__dirname, '..', 'api', 'chats_extended.csv');

/**
 * Obtiene credenciales desde variable de entorno
 */
function getCredentials() {
  const googleCredentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;

  if (!googleCredentialsJson) {
    throw new Error('❌ Variable GOOGLE_CREDENTIALS_JSON no encontrada en .env');
  }

  try {
    const credentials = JSON.parse(googleCredentialsJson);
    console.log('🔒 Usando credenciales desde variable de entorno (.env)');

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    return auth;
  } catch (error) {
    throw new Error(`❌ Error parseando GOOGLE_CREDENTIALS_JSON: ${error.message}`);
  }
}

/**
 * Lee CSV y convierte a array
 */
async function readCSV() {
  return new Promise((resolve, reject) => {
    const results = [];
    const headers = [];
    let isFirstRow = true;

    if (!fs.existsSync(CSV_FILE)) {
      reject(new Error(`❌ Archivo no encontrado: ${CSV_FILE}`));
      return;
    }

    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on('headers', (headerList) => {
        headers.push(...headerList);
      })
      .on('data', (data) => {
        if (isFirstRow) {
          results.push(headers);
          isFirstRow = false;
        }
        results.push(Object.values(data));
      })
      .on('end', () => {
        console.log(`📖 CSV leído: ${results.length - 1} filas, ${headers.length} columnas`);
        console.log(`📋 Columnas: ${headers.join(', ')}`);
        resolve(results);
      })
      .on('error', reject);
  });
}

/**
 * Actualiza Google Sheets
 */
async function updateGoogleSheets(data) {
  try {
    const auth = getCredentials();
    const sheets = google.sheets({ version: 'v4', auth });

    console.log(`🔄 Limpiando hoja "${RANGE_NAME}"...`);
    
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: RANGE_NAME,
      });
    } catch (error) {
      console.log(`⚠️ La hoja "${RANGE_NAME}" no existe, se creará automáticamente`);
    }

    console.log('📤 Subiendo nueva data...');
    const result = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${RANGE_NAME}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: data
      }
    });

    console.log(`✅ Actualización exitosa! Filas: ${result.data.updatedRows}, Columnas: ${result.data.updatedColumns}`);
    return result;

  } catch (error) {
    throw new Error(`❌ Error actualizando Google Sheets: ${error.message}`);
  }
}

/**
 * Limpia archivo temporal
 */
function cleanupFile() {
  try {
    if (fs.existsSync(CSV_FILE)) {
      fs.unlinkSync(CSV_FILE);
      console.log('🧹 Archivo temporal eliminado');
    }
  } catch (error) {
    console.warn(`⚠️ No se pudo eliminar archivo temporal: ${error.message}`);
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 Iniciando sincronización EXTENDIDA con Google Sheets...');
    console.log(`📊 Spreadsheet ID: ${SPREADSHEET_ID}`);
    console.log(`📄 Hoja destino: ${RANGE_NAME}`);

    // Leer CSV
    const csvData = await readCSV();

    // Actualizar Google Sheets
    await updateGoogleSheets(csvData);

    // Limpiar archivo
    cleanupFile();

    console.log('✅ Proceso completado exitosamente!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error en el proceso:', error.message);
    cleanupFile();
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { main };
