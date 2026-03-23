const { Readable } = require('stream');
const csv = require('csv-parser');
const { Storage } = require('@google-cloud/storage');
const { google } = require('googleapis');
require('dotenv').config();

// Configuracion
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '1Johw_83AhQU-bMwL36x9CV8q1yTwhxsojiBkAMkMh2U';
const RANGE_NAME = 'Historial';
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'avi-bkt';
const BUCKET_PATH = normalizeBucketPath(process.env.GCS_BUCKET_PATH || 'chats/');
const FILE_PREFIX = process.env.GCS_HISTORIAL_FILE_PREFIX || 'chats_extended_';

function normalizeBucketPath(bucketPath) {
  if (!bucketPath) {
    return '';
  }
  return bucketPath.endsWith('/') ? bucketPath : `${bucketPath}/`;
}

function getGCSClient() {
  const googleCredentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;

  if (!googleCredentialsJson) {
    throw new Error('Variable GOOGLE_CREDENTIALS_JSON no encontrada en .env');
  }

  try {
    const credentials = JSON.parse(googleCredentialsJson);
    console.log('Usando credenciales desde variable de entorno (.env)');
    return new Storage({ credentials });
  } catch (error) {
    throw new Error(`Error parseando GOOGLE_CREDENTIALS_JSON: ${error.message}`);
  }
}

function getSheetsAuth() {
  const googleCredentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;

  if (!googleCredentialsJson) {
    throw new Error('Variable GOOGLE_CREDENTIALS_JSON no encontrada en .env');
  }

  try {
    const credentials = JSON.parse(googleCredentialsJson);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
  } catch (error) {
    throw new Error(`Error parseando GOOGLE_CREDENTIALS_JSON: ${error.message}`);
  }
}

function parseCsvBuffer(csvBuffer, fileName) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const headers = [];

    Readable.from(csvBuffer)
      .pipe(csv())
      .on('headers', (headerList) => {
        headers.push(...headerList);
      })
      .on('data', (data) => {
        rows.push(headers.map((h) => (data[h] ?? '').toString()));
      })
      .on('end', () => {
        resolve({ headers, rows, fileName });
      })
      .on('error', (error) => {
        reject(new Error(`Error leyendo CSV ${fileName}: ${error.message}`));
      });
  });
}

async function listTargetCsvFiles(storage) {
  const [files] = await storage.bucket(BUCKET_NAME).getFiles({ prefix: BUCKET_PATH });

  const csvFiles = (files || [])
    .filter((file) => {
      const fullName = file.name || '';
      const baseName = fullName.split('/').pop() || '';
      return fullName.endsWith('.csv') && baseName.startsWith(FILE_PREFIX);
    })
    .sort((a, b) => (a.name < b.name ? -1 : 1));

  if (!csvFiles.length) {
    throw new Error(
      `No se encontraron CSV en gs://${BUCKET_NAME}/${BUCKET_PATH} con prefijo ${FILE_PREFIX}`
    );
  }

  return csvFiles;
}

function assertCompatibleHeaders(baseHeaders, currentHeaders, fileName) {
  if (baseHeaders.length !== currentHeaders.length) {
    throw new Error(
      `Encabezados incompatibles en ${fileName}: columnas esperadas ${baseHeaders.length}, recibidas ${currentHeaders.length}`
    );
  }

  for (let i = 0; i < baseHeaders.length; i += 1) {
    if (baseHeaders[i] !== currentHeaders[i]) {
      throw new Error(
        `Encabezados incompatibles en ${fileName}: diferencia en columna ${i + 1} (${baseHeaders[i]} vs ${currentHeaders[i]})`
      );
    }
  }
}

function parseDateToMs(dateValue) {
  const parsed = Date.parse(dateValue);
  if (Number.isNaN(parsed)) {
    return Number.NEGATIVE_INFINITY;
  }
  return parsed;
}

function dedupeRows(rows) {
  const seen = new Set();
  const deduped = [];

  for (const row of rows) {
    const key = JSON.stringify(row);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(row);
    }
  }

  return deduped;
}

async function buildMergedDataFromGCS() {
  const storage = getGCSClient();
  const files = await listTargetCsvFiles(storage);

  console.log(`CSV detectados en GCS: ${files.length}`);

  let baseHeaders = null;
  let allRows = [];

  for (const file of files) {
    const [csvBuffer] = await file.download();
    const parsed = await parseCsvBuffer(csvBuffer, file.name);

    if (!baseHeaders) {
      baseHeaders = parsed.headers;
    } else {
      assertCompatibleHeaders(baseHeaders, parsed.headers, file.name);
    }

    allRows = allRows.concat(parsed.rows);
    console.log(`Procesado: ${file.name} -> ${parsed.rows.length} filas`);
  }

  if (!baseHeaders || !baseHeaders.length) {
    throw new Error('No se pudo detectar encabezado en los CSV procesados');
  }

  const updatedAtIndex = baseHeaders.indexOf('conversationUpdatedAt');
  if (updatedAtIndex === -1) {
    throw new Error('No se encontro la columna conversationUpdatedAt en los CSV');
  }

  const originalCount = allRows.length;
  const dedupedRows = dedupeRows(allRows);
  const removedDuplicates = originalCount - dedupedRows.length;

  dedupedRows.sort((rowA, rowB) => {
    const a = parseDateToMs(rowA[updatedAtIndex]);
    const b = parseDateToMs(rowB[updatedAtIndex]);
    return b - a;
  });

  console.log(`Filas totales antes de dedupe: ${originalCount}`);
  console.log(`Duplicados removidos (fila completa): ${removedDuplicates}`);
  console.log(`Filas finales para Historial: ${dedupedRows.length}`);

  return [baseHeaders, ...dedupedRows];
}

async function updateGoogleSheets(values) {
  const auth = getSheetsAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  console.log(`Limpiando hoja ${RANGE_NAME}...`);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE_NAME,
  });

  console.log(`Subiendo data consolidada a ${RANGE_NAME}...`);
  const result = await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${RANGE_NAME}!A1`,
    valueInputOption: 'RAW',
    requestBody: {
      values,
    },
  });

  console.log(
    `Actualizacion exitosa. Filas: ${result.data.updatedRows || 0}, Columnas: ${result.data.updatedColumns || 0}`
  );
}

async function main() {
  try {
    console.log('Iniciando flujo independiente GCS -> Sheets Historial...');
    console.log(`Bucket: ${BUCKET_NAME}`);
    console.log(`Path: ${BUCKET_PATH}`);
    console.log(`Prefijo de archivo: ${FILE_PREFIX}`);

    const values = await buildMergedDataFromGCS();
    await updateGoogleSheets(values);

    console.log('Proceso Historial completado exitosamente');
    process.exit(0);
  } catch (error) {
    console.error(`Error en GCS -> Sheets Historial: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
  buildMergedDataFromGCS,
  dedupeRows,
};
