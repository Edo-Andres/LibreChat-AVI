const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const {
  normalizeBucketPath,
  getGCSClient,
  getSheetsAuth,
  parseCsvBuffer,
  listTargetCsvFiles,
  mergeHeaders,
  parseDateToMs,
  getRowSortMs,
} = require('./gcs-to-sheets-historial');
require('dotenv').config();

/**
 * Historial acumulativo "Full Daily" (solo agrega, nunca borra ni modifica filas):
 *   base  = CSV existentes en GCS (solo lectura, no se generan archivos nuevos)
 *   nuevo = CSV enmascarado exportado desde Mongo (api/chats_full_daily.csv)
 * Se agregan a la pestana solo las filas cuya clave conversationId::messageId aun no existe.
 */

// Configuracion
const SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_ID || '1Johw_83AhQU-bMwL36x9CV8q1yTwhxsojiBkAMkMh2U';
const TAB_NAME = process.env.GOOGLE_SHEETS_FULL_DAILY_TAB || 'FullDaily';
const BUCKET_NAME = process.env.GCS_FULL_DAILY_BUCKET || process.env.GCS_BUCKET_NAME || 'avi-bkt';
const BUCKET_PATH = normalizeBucketPath(
  process.env.GCS_FULL_DAILY_PATH || process.env.GCS_BUCKET_PATH || 'chats/',
);
const FILE_PREFIX =
  process.env.GCS_FULL_DAILY_FILE_PREFIX ||
  process.env.GCS_HISTORIAL_FILE_PREFIX ||
  'chats_extended_';
const MONGO_CSV_FILE = path.join(__dirname, '..', 'api', 'chats_full_daily.csv');

const PII_COLUMNS = ['userEmail', 'userName', 'userPhone'];
const MASK_VALUE = '***';
const MAX_CELL_CHARS = 49000; // Sheets rechaza celdas > 50.000 caracteres
const APPEND_MAX_ROWS = 2000;
const APPEND_MAX_CHARS = 1500000; // mantiene cada request bajo ~2MB

const a1 = (range) => `'${TAB_NAME.replace(/'/g, "''")}'!${range}`;

function columnLetter(index) {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rest = (n - 1) % 26;
    letters = String.fromCharCode(65 + rest) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

const buildKey = (record) => {
  const conversationId = String(record.conversationId || '').trim();
  const messageId = String(record.messageId || '').trim();
  return conversationId && messageId ? `${conversationId}::${messageId}` : '';
};

/**
 * Lee de la hoja solo el encabezado y las columnas conversationId/messageId
 * (evita descargar todo el contenido, que puede ser muy grande).
 */
async function readSheetState(sheets) {
  let headers;
  try {
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: a1('1:1'),
    });
    headers = (headerResponse.data.values && headerResponse.data.values[0]) || [];
  } catch (error) {
    throw new Error(
      `No se pudo leer la pestana "${TAB_NAME}" (debe existir en el Sheet): ${error.message}`,
    );
  }

  if (!headers.length) {
    return { headers: [], keys: new Set() };
  }

  const conversationIdx = headers.indexOf('conversationId');
  const messageIdx = headers.indexOf('messageId');
  if (conversationIdx === -1 || messageIdx === -1) {
    throw new Error(
      `La pestana "${TAB_NAME}" tiene encabezado pero sin columnas conversationId/messageId`,
    );
  }

  const convLetter = columnLetter(conversationIdx);
  const msgLetter = columnLetter(messageIdx);
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges: [a1(`${convLetter}2:${convLetter}`), a1(`${msgLetter}2:${msgLetter}`)],
  });

  const [convColumn, msgColumn] = response.data.valueRanges.map((range) => range.values || []);
  const keys = new Set();
  const total = Math.max(convColumn.length, msgColumn.length);
  for (let i = 0; i < total; i += 1) {
    const key = buildKey({
      conversationId: (convColumn[i] || [])[0],
      messageId: (msgColumn[i] || [])[0],
    });
    if (key) {
      keys.add(key);
    }
  }

  return { headers, keys };
}

async function readMongoCsv() {
  if (!fs.existsSync(MONGO_CSV_FILE)) {
    throw new Error(
      `No se encontro ${MONGO_CSV_FILE}. Ejecuta antes: npm run export-chats-full-daily`,
    );
  }
  return parseCsvBuffer(fs.readFileSync(MONGO_CSV_FILE), 'Mongo (chats_full_daily.csv)');
}

/**
 * Enmascara PII y devuelve solo los registros con clave nueva (sin duplicar ni contra la hoja
 * ni contra fuentes ya procesadas). Actualiza `seen` con las claves aceptadas.
 */
function collectNewRecords(rows, seen, label) {
  const accepted = [];
  let duplicates = 0;
  let withoutKey = 0;

  for (const record of rows) {
    const key = buildKey(record);
    if (!key) {
      withoutKey += 1;
      continue;
    }
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);

    for (const column of PII_COLUMNS) {
      if (column in record) {
        record[column] = MASK_VALUE;
      }
    }
    accepted.push(record);
  }

  console.log(
    `${label}: ${rows.length} filas -> ${accepted.length} nuevas, ${duplicates} ya existentes, ${withoutKey} sin conversationId/messageId (descartadas)`,
  );
  return accepted;
}

function projectRows(records, headers) {
  const epochIdx = headers.indexOf('messageCreatedAtEpoch');
  const createdAtIdx = headers.indexOf('messageCreatedAt');

  const rows = records.map((record) =>
    headers.map((header) => String(record[header] ?? '').slice(0, MAX_CELL_CHARS)),
  );

  if (epochIdx !== -1) {
    for (const row of rows) {
      const epoch = parseDateToMs(row[epochIdx]);
      row[epochIdx] = epoch === Number.NEGATIVE_INFINITY ? '' : epoch;
    }
  }

  // Orden ascendente: lo mas nuevo queda al final de la hoja.
  rows.sort((rowA, rowB) => {
    const a = getRowSortMs(rowA, [epochIdx, createdAtIdx]);
    const b = getRowSortMs(rowB, [epochIdx, createdAtIdx]);
    return a < b ? -1 : a > b ? 1 : 0;
  });

  return rows;
}

function* chunkRows(rows) {
  let chunk = [];
  let chars = 0;
  for (const row of rows) {
    const rowChars = row.reduce((sum, cell) => sum + String(cell).length, 0);
    if (chunk.length && (chunk.length >= APPEND_MAX_ROWS || chars + rowChars > APPEND_MAX_CHARS)) {
      yield chunk;
      chunk = [];
      chars = 0;
    }
    chunk.push(row);
    chars += rowChars;
  }
  if (chunk.length) {
    yield chunk;
  }
}

async function appendToSheet(sheets, values) {
  let appendedRows = 0;
  for (const chunk of chunkRows(values)) {
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: a1('A1'),
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: chunk },
    });
    appendedRows += result.data.updates?.updatedRows || 0;
    console.log(`Lote agregado: ${chunk.length} filas (acumulado ${appendedRows})`);
  }
  return appendedRows;
}

function removeTempCsv() {
  try {
    if (fs.existsSync(MONGO_CSV_FILE)) {
      fs.unlinkSync(MONGO_CSV_FILE);
      console.log('Archivo temporal eliminado');
    }
  } catch (error) {
    console.warn(`No se pudo eliminar archivo temporal: ${error.message}`);
  }
}

async function main() {
  try {
    console.log('Iniciando Full Daily (GCS base + Mongo -> Sheets, solo agrega)...');
    console.log(
      `Hoja: ${TAB_NAME} | Bucket: gs://${BUCKET_NAME}/${BUCKET_PATH} | Prefijo: ${FILE_PREFIX}`,
    );

    const sheets = google.sheets({ version: 'v4', auth: getSheetsAuth() });

    const sheetState = await readSheetState(sheets);
    const seen = sheetState.keys;
    console.log(`Filas existentes en la hoja: ${seen.size}`);

    // El encabezado de Mongo (21 columnas actuales) define el orden si la hoja esta vacia.
    const mongo = await readMongoCsv();
    let sourceHeaders = mongo.headers;

    const storage = getGCSClient();
    const files = await listTargetCsvFiles(storage, {
      bucketName: BUCKET_NAME,
      bucketPath: BUCKET_PATH,
      filePrefix: FILE_PREFIX,
    });
    console.log(`CSV base detectados en GCS: ${files.length}`);

    const newRecords = [];
    for (const file of files) {
      const [csvBuffer] = await file.download();
      const parsed = await parseCsvBuffer(csvBuffer, file.name);
      sourceHeaders = mergeHeaders(sourceHeaders, parsed.headers, file.name);
      newRecords.push(...collectNewRecords(parsed.rows, seen, `GCS ${file.name}`));
    }
    newRecords.push(...collectNewRecords(mongo.rows, seen, 'Mongo'));

    const headers = sheetState.headers.length ? sheetState.headers : sourceHeaders;
    const ignored = sourceHeaders.filter((header) => !headers.includes(header));
    if (ignored.length) {
      console.warn(`Columnas de origen ausentes en la hoja (se ignoran): ${ignored.join(', ')}`);
    }

    if (!newRecords.length) {
      console.log('0 filas nuevas. La hoja ya esta al dia.');
      return 0;
    }

    const rows = projectRows(newRecords, headers);
    const values = sheetState.headers.length ? rows : [headers, ...rows];
    await appendToSheet(sheets, values);

    console.log(`Full Daily completado: ${rows.length} filas nuevas agregadas a "${TAB_NAME}"`);
    return 0;
  } catch (error) {
    console.error(`Error en Full Daily: ${error.message}`);
    return 1;
  } finally {
    removeTempCsv();
  }
}

if (require.main === module) {
  main().then((code) => process.exit(code));
}

module.exports = { main, collectNewRecords, buildKey, projectRows, columnLetter };
