const path = require('path');
const fs = require('fs');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { silentExit } = require('./helpers');
const { Conversation, Message } = require('~/db/models');
const { User } = require('~/db/models');
const connect = require('./connect');

// DEPRECATED: este export legacy (11 cols) queda como wrapper hacia el extendido enmascarado (20 cols, ***).
// Se mantiene para no romper `npm run export-all-chats` / crons antiguos.
// Nuevo flujo Daily: `npm run export-chats-daily` -> config/export-all-chats-extended.js --mask-pii -> api/chats.csv
const DEPRECATED_NOTICE =
  '⚠️  DEPRECATED: config/export-all-chats.js (11 cols) -> redirigiendo a export-all-chats-extended --mask-pii (20 cols, *** en PII)';

/**
 * Extrae el texto de los mensajes
 */
function extractTextFromContent(content) {
  if (!content || !Array.isArray(content)) return '';
  return content
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join(' ');
}

/**
 * Limpia el texto para CSV
 */
function cleanTextForCSV(text) {
  if (!text) return '';
  return text.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/"/g, '""').trim();
}

/**
 * Convierte fecha a zona horaria America/Santiago
 */
function formatDateWithTimezone(date) {
  if (!date) return '';

  const timezone = process.env.TZ || 'America/Santiago';

  try {
    // Crear formato ISO compatible con CSV usando la zona horaria configurada
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
    // Fallback a ISO si hay problemas
    console.warn(`⚠️ Error convirtiendo fecha a ${timezone}, usando UTC:`, error.message);
    return new Date(date).toISOString();
  }
}

(async () => {
  await connect();

  console.purple('----------------------------------------');
  console.purple('🗂️ Exportar TODAS las Conversaciones');
  console.purple('----------------------------------------');
  console.orange(DEPRECATED_NOTICE);
  console.orange('   Nuevo Daily: npm run export-chats-daily  (20 cols, *** en userEmail/userName/userPhone)');
  console.orange('   Historial/GCS: npm run export-chats-extended (20 cols en claro)');

  // Si se llama sin --no-mask, el wrapper enmascara por defecto (seguro para Daily)
  const NO_MASK = process.argv.includes('--no-mask');
  const MASK_PII_WRAPPER = !NO_MASK;
  const MASK_VALUE = '***';

  let format = process.argv[2] || 'csv';
  let outputFile = process.argv[3];
  // Permitir que el tercer arg sea --no-mask
  if (outputFile === '--no-mask' || outputFile === '--mask-pii') outputFile = undefined;

  // Validar formato
  if (!['csv', 'json'].includes(format.toLowerCase())) {
    if (format === '--no-mask' || format === '--mask-pii') {
      format = 'csv';
    } else {
      console.orange('Uso: npm run export-all-chats [csv|json] [archivo] [--no-mask]');
      console.orange('Ejemplo: npm run export-all-chats csv todas_conversaciones.csv');
      format = 'csv';
    }
  }
  format = format.toLowerCase();

  try {
    console.orange(`👥 Obteniendo usuarios con AVI Roles... (máscara PII: ${MASK_PII_WRAPPER ? '***' : 'desactivada'})`);
    const users = await User.find({}, 'email name phone ageRange region aviRol_id aviSubrol_id participationConsent createdAt')
      .populate('aviRol_id', 'name')
      .populate('aviSubrol_id', 'name')
      .lean();

    console.orange('📂 Obteniendo todas las conversaciones...');
    const conversations = await Conversation.find({}).sort({ updatedAt: -1 }).lean();

    console.orange('💬 Obteniendo todos los mensajes...');
    const messages = await Message.find({}).sort({ createdAt: 1 }).lean();

    console.green(
      `✅ ${users.length} usuarios, ${conversations.length} conversaciones, ${messages.length} mensajes`,
    );

    // Crear mapas para búsqueda rápida (paridad con export-all-chats-extended)
    const userMap = {};
    users.forEach((user) => {
      userMap[user._id.toString()] = {
        ...user,
        userId: user._id.toString(),
        email: user.email || '',
        name: user.name || '',
        phone: user.phone || '',
        ageRange: user.ageRange || '',
        region: user.region || '',
        participationConsent: Boolean(user.participationConsent),
        aviRole: user.aviRol_id?.name || '',
        aviSubrole: user.aviSubrol_id?.name || '',
        createdAt: user.createdAt,
      };
    });

    function cleanTextForCSVWrapper(text) {
      if (!text) return '';
      return text.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/"/g, '""').trim();
    }
    function formatDateWithTimezoneWrapper(date) {
      if (!date) return '';
      const timezone = process.env.TZ || 'America/Santiago';
      try {
        return new Date(date).toLocaleString('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(' ', 'T') + '.000Z';
      } catch (e) {
        return new Date(date).toISOString();
      }
    }
    function toEpochMsWrapper(date) {
      if (!date) return '';
      const epoch = new Date(date).getTime();
      return Number.isFinite(epoch) ? epoch : '';
    }
    function serializeFeedbackWrapper(feedback) {
      if (!feedback) return '';
      if (typeof feedback === 'object') {
        try {
          const rating = feedback.rating || '';
          const tag = feedback.tag ? String(feedback.tag) : '';
          const text = feedback.text || '';
          return `${rating}${tag ? '|' + tag : ''}${text ? '|' + text : ''}`;
        } catch (e) {
          return JSON.stringify(feedback).replace(/"/g, '""');
        }
      }
      return String(feedback);
    }

    // Determinar archivo de salida
    if (!outputFile) {
      const timestamp = new Date().toISOString().slice(0, 10);
      // ✅ Si no hay outputFile, usar 'chats.csv' para CSV o el nombre con timestamp para JSON
      outputFile = format === 'csv' ? 'chats.csv' : `todas_conversaciones_${timestamp}.${format}`;
    }

    console.orange('📝 Generando exportación...');

    if (format === 'json') {
      // Generar JSON con paridad extendida (Daily enmascarado por defecto)
      const result = {
        exportDate: formatDateWithTimezoneWrapper(new Date()),
        totalUsers: users.length,
        totalConversations: conversations.length,
        totalMessages: messages.length,
        users: {},
      };

      conversations.forEach((conv) => {
        const user = userMap[conv.user];
        if (!user) return;

        const userEmail = MASK_PII_WRAPPER ? MASK_VALUE : user.email;
        if (!result.users[userEmail]) {
          result.users[userEmail] = {
            userInfo: {
              userId: user.userId,
              email: MASK_PII_WRAPPER ? MASK_VALUE : user.email,
              name: MASK_PII_WRAPPER ? MASK_VALUE : user.name,
              phone: MASK_PII_WRAPPER ? MASK_VALUE : user.phone,
              ageRange: user.ageRange || '',
              region: user.region || '',
              participationConsent: user.participationConsent,
              aviRole: user.aviRole || '',
              aviSubrole: user.aviSubrole || '',
              userCreatedAt: formatDateWithTimezoneWrapper(user.createdAt),
            },
            conversations: [],
          };
        }

        const convMessages = messages
          .filter((msg) => msg.conversationId === conv.conversationId)
          .map((msg) => ({
            messageId: msg.messageId,
            sender: msg.sender || '',
            text: msg.text || extractTextFromContent(msg.content),
            isCreatedByUser: msg.isCreatedByUser || false,
            messageCreatedAt: formatDateWithTimezoneWrapper(msg.createdAt),
            messageCreatedAtEpoch: toEpochMsWrapper(msg.createdAt),
            feedback: msg.feedback || null,
          }));

        result.users[userEmail].conversations.push({
          conversationId: conv.conversationId,
          title: conv.title || 'Sin título',
          conversationCreatedAt: formatDateWithTimezoneWrapper(conv.createdAt),
          conversationUpdatedAt: formatDateWithTimezoneWrapper(conv.updatedAt),
          messageCount: convMessages.length,
          messages: convMessages,
        });
      });

      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf8');
    } else {
      // Generar CSV con 20 cols (paridad con Historial) - Daily enmascarado ***
      const header = [
        'userId','userEmail','userName','userPhone','userAgeRange','userRegion','userParticipationConsent',
        'userAviRole','userAviSubrole','userCreatedAt','conversationId','conversationTitle','conversationCreatedAt','conversationUpdatedAt',
        'sender','text','isCreatedByUser','messageId','messageCreatedAt','messageCreatedAtEpoch','feedback',
      ].join(',');
      const lines = [header];

      conversations.forEach((conv) => {
        const user = userMap[conv.user];
        if (!user) return;

        const convMessages = messages.filter((msg) => msg.conversationId === conv.conversationId);

        convMessages.forEach((msg) => {
          let text = msg.text || extractTextFromContent(msg.content);
          text = cleanTextForCSVWrapper(text);

          const row = [
            user.userId,
            MASK_PII_WRAPPER ? MASK_VALUE : user.email,
            MASK_PII_WRAPPER ? `"${MASK_VALUE}"` : `"${cleanTextForCSVWrapper(user.name || '')}"`,
            MASK_PII_WRAPPER ? MASK_VALUE : (user.phone || ''),
            `"${cleanTextForCSVWrapper(user.ageRange || '')}"`,
            `"${cleanTextForCSVWrapper(user.region || '')}"`,
            user.participationConsent,
            `"${cleanTextForCSVWrapper(user.aviRole || '')}"`,
            `"${cleanTextForCSVWrapper(user.aviSubrole || '')}"`,
            formatDateWithTimezoneWrapper(user.createdAt),
            conv.conversationId,
            `"${cleanTextForCSVWrapper(conv.title || 'Sin título')}"`,
            formatDateWithTimezoneWrapper(conv.createdAt),
            formatDateWithTimezoneWrapper(conv.updatedAt),
            msg.sender || '',
            `"${text}"`,
            msg.isCreatedByUser || false,
            msg.messageId,
            formatDateWithTimezoneWrapper(msg.createdAt),
            toEpochMsWrapper(msg.createdAt),
            `"${serializeFeedbackWrapper(msg.feedback)}"`,
          ];
          lines.push(row.join(','));
        });
      });

      fs.writeFileSync(outputFile, lines.join('\n'), 'utf8');
    }

    // Mostrar resumen
    console.purple('----------------------------------------');
    console.green('✅ ¡Exportación masiva completada!');
    console.purple('----------------------------------------');
    console.cyan(`👥 Total usuarios: ${users.length}`);
    console.cyan(`📊 Total conversaciones: ${conversations.length}`);
    console.cyan(`💬 Total mensajes: ${messages.length}`);
    console.cyan(`📁 Formato: ${format.toUpperCase()}`);
    console.cyan(`💾 Archivo: ${outputFile}`);
    console.cyan(`📅 Fecha: ${new Date().toLocaleString()}`);
    console.purple('----------------------------------------');

    silentExit(0);
  } catch (error) {
    console.red('❌ Error durante la exportación:');
    console.red(error.message);
    silentExit(1);
  }
})();

process.on('uncaughtException', (err) => {
  if (!err.message.includes('fetch failed')) {
    console.error('Error inesperado:', err);
    process.exit(1);
  }
});
