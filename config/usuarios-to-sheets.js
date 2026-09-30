const path = require('path');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { google } = require('googleapis');
const { silentExit } = require('./helpers');
const { User } = require('~/db/models');
const connect = require('./connect');
const { getSheetsAuth } = require('./gcs-to-sheets-historial');

/**
 * Snapshot de usuarios (Mongo -> pestana "usuarios" de Google Sheets).
 * Se reescribe completo en cada corrida: una fila por usuario registrado, PII en claro.
 */

// Configuracion
const SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_ID || '1Johw_83AhQU-bMwL36x9CV8q1yTwhxsojiBkAMkMh2U';
const TAB_NAME = process.env.GOOGLE_SHEETS_USUARIOS_TAB || 'usuarios';
const HEADERS = [
  'userId',
  'userEmail',
  'userName',
  'userPhone',
  'userAgeRange',
  'userRegion',
  'userParticipationConsent',
  'userAviRole',
  'userAviSubrole',
  'userCreatedAt',
];

const a1 = (range) => `'${TAB_NAME.replace(/'/g, "''")}'!${range}`;

/**
 * Mismo formato que userCreatedAt en Daily/FullDaily (hora de TZ con sufijo .000Z),
 * para que los valores coincidan entre pestanas.
 */
function formatDateWithTimezone(date) {
  if (!date) return '';
  const timezone = process.env.TZ || 'America/Santiago';
  try {
    return (
      new Date(date)
        .toLocaleString('sv-SE', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        .replace(' ', 'T') + '.000Z'
    );
  } catch (error) {
    return new Date(date).toISOString();
  }
}

async function fetchUserRows() {
  const users = await User.find({})
    .populate('aviRol_id', 'name')
    .populate('aviSubrol_id', 'name')
    .select(
      'email name phone ageRange region aviRol_id aviSubrol_id participationConsent createdAt',
    )
    .sort({ createdAt: 1 })
    .lean();

  return users.map((user) => [
    user._id.toString(),
    user.email || '',
    user.name || '',
    user.phone || '',
    user.ageRange || '',
    user.region || '',
    Boolean(user.participationConsent),
    user.aviRol_id?.name || '',
    user.aviSubrol_id?.name || '',
    formatDateWithTimezone(user.createdAt),
  ]);
}

async function writeToSheet(values) {
  const sheets = google.sheets({ version: 'v4', auth: getSheetsAuth() });

  try {
    // Primero se escribe y luego se limpia el sobrante: la hoja nunca queda vacia si algo falla.
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: a1('A1'),
      valueInputOption: 'RAW',
      requestBody: { values },
    });
  } catch (error) {
    throw new Error(
      `No se pudo escribir en la pestana "${TAB_NAME}" (debe existir en el Sheet): ${error.message}`,
    );
  }

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: a1(`A${values.length + 1}:Z`),
  });
}

(async () => {
  try {
    await connect();
    console.log(`Hoja: ${TAB_NAME} | Obteniendo usuarios de Mongo...`);

    const rows = await fetchUserRows();
    if (!rows.length) {
      throw new Error('Mongo no devolvio usuarios: no se modifica la hoja');
    }

    await writeToSheet([HEADERS, ...rows]);
    console.log(`Usuarios escritos en "${TAB_NAME}": ${rows.length}`);
    silentExit(0);
  } catch (error) {
    console.error(`Error en usuarios -> Sheets: ${error.message}`);
    silentExit(1);
  }
})();
