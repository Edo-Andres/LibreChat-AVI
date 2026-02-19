const path = require('path');
const fs = require('fs');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { silentExit } = require('./helpers');
const { Conversation, Message } = require('~/db/models');
const { User } = require('~/db/models');
const connect = require('./connect');

/**
 * Extrae el texto de los mensajes
 */
function extractTextFromContent(content) {
  if (!content || !Array.isArray(content)) return '';
  return content
    .filter(item => item.type === 'text')
    .map(item => item.text)
    .join(' ');
}

/**
 * Limpia el texto para CSV
 */
function cleanTextForCSV(text) {
  if (!text) return '';
  return text
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/"/g, '""')
    .trim();
}

/**
 * Convierte objeto feedback a string legible para CSV
 */
function serializeFeedback(feedback) {
  if (!feedback) return '';
  if (typeof feedback === 'object') {
    try {
      // Formato: rating|tag|text
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

/**
 * Convierte fecha a zona horaria America/Santiago
 */
function formatDateWithTimezone(date) {
  if (!date) return '';

  const timezone = process.env.TZ || 'America/Santiago';

  try {
    return new Date(date).toLocaleString('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(' ', 'T') + '.000Z';
  } catch (error) {
    console.warn(`⚠️ Error convirtiendo fecha a ${timezone}, usando UTC:`, error.message);
    return new Date(date).toISOString();
  }
}

(async () => {
  await connect();

  console.purple('----------------------------------------------------');
  console.purple('🗂️ Exportar Conversaciones (VERSIÓN EXTENDIDA)');
  console.purple('----------------------------------------------------');

  let format = process.argv[2] || 'csv';
  let outputFile = process.argv[3];

  // Validar formato
  if (!['csv', 'json'].includes(format.toLowerCase())) {
    console.orange('Uso: npm run export-chats-extended [csv|json] [archivo]');
    console.orange('Ejemplo: npm run export-chats-extended csv chats_extended.csv');
    format = 'csv';
  }
  format = format.toLowerCase();

  try {
    console.orange('👥 Obteniendo usuarios con AVI Roles...');
    // ⭐ POPULATE aviRol_id y aviSubrol_id para obtener nombres
    const users = await User.find({})
      .populate('aviRol_id', 'name')
      .populate('aviSubrol_id', 'name')
      .select('email name phone aviRol_id aviSubrol_id createdAt')
      .lean();

    console.orange('📂 Obteniendo conversaciones con fechas...');
    const conversations = await Conversation.find({})
      .select('conversationId title user createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean();

    console.orange('💬 Obteniendo mensajes con feedback...');
    const messages = await Message.find({})
      .select('messageId conversationId sender text content isCreatedByUser createdAt feedback')
      .sort({ createdAt: 1 })
      .lean();

    console.green(`✅ ${users.length} usuarios, ${conversations.length} conversaciones, ${messages.length} mensajes`);

    // Crear mapa de usuarios con TODOS los campos requeridos
    const userMap = {};
    users.forEach(user => {
      userMap[user._id.toString()] = {
        userId: user._id.toString(),
        email: user.email || '',
        name: user.name || '',
        phone: user.phone || '',
        // ⭐ Extraer NOMBRES de los aviRoles (no ObjectId)
        aviRole: user.aviRol_id?.name || '',
        aviSubrole: user.aviSubrol_id?.name || '',
        createdAt: user.createdAt
      };
    });

    // Determinar archivo de salida
    if (!outputFile) {
      const timestamp = new Date().toISOString().slice(0, 10);
      outputFile = format === 'csv' ? 'chats_extended.csv' : `chats_extended_${timestamp}.${format}`;
    }

    console.orange('📝 Generando exportación extendida...');

    if (format === 'json') {
      // Generar JSON con estructura extendida
      const result = {
        exportDate: formatDateWithTimezone(new Date()),
        totalUsers: users.length,
        totalConversations: conversations.length,
        totalMessages: messages.length,
        users: {}
      };

      conversations.forEach(conv => {
        const user = userMap[conv.user];
        if (!user) return;

        const userEmail = user.email;
        if (!result.users[userEmail]) {
          result.users[userEmail] = {
            userInfo: {
              userId: user.userId,
              email: user.email,
              name: user.name,
              phone: user.phone,
              aviRole: user.aviRole,
              aviSubrole: user.aviSubrole,
              userCreatedAt: formatDateWithTimezone(user.createdAt)
            },
            conversations: []
          };
        }

        const convMessages = messages
          .filter(msg => msg.conversationId === conv.conversationId)
          .map(msg => ({
            messageId: msg.messageId,
            sender: msg.sender || '',
            text: msg.text || extractTextFromContent(msg.content),
            isCreatedByUser: msg.isCreatedByUser || false,
            messageCreatedAt: formatDateWithTimezone(msg.createdAt),
            feedback: msg.feedback || null
          }));

        result.users[userEmail].conversations.push({
          conversationId: conv.conversationId,
          title: conv.title || 'Sin título',
          conversationCreatedAt: formatDateWithTimezone(conv.createdAt),
          conversationUpdatedAt: formatDateWithTimezone(conv.updatedAt),
          messageCount: convMessages.length,
          messages: convMessages
        });
      });

      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf8');

    } else {
      // ⭐ Generar CSV con TODAS LAS COLUMNAS NUEVAS
      const header = [
        'userId',
        'userEmail',
        'userName',
        'userPhone',
        'userAviRole',
        'userAviSubrole',
        'userCreatedAt',
        'conversationId',
        'conversationTitle',
        'conversationCreatedAt',
        'conversationUpdatedAt',
        'sender',
        'text',
        'isCreatedByUser',
        'messageId',
        'messageCreatedAt',
        'feedback'
      ].join(',');

      const lines = [header];

      conversations.forEach(conv => {
        const user = userMap[conv.user];
        if (!user) return;

        const convMessages = messages.filter(msg => msg.conversationId === conv.conversationId);

        convMessages.forEach(msg => {
          let text = msg.text || extractTextFromContent(msg.content);
          text = cleanTextForCSV(text);

          const row = [
            // ⭐ DATOS DE USUARIO
            user.userId,
            user.email,
            `"${cleanTextForCSV(user.name)}"`,
            user.phone,
            user.aviRole,
            user.aviSubrole,
            formatDateWithTimezone(user.createdAt),
            
            // ⭐ DATOS DE CONVERSACIÓN
            conv.conversationId,
            `"${cleanTextForCSV(conv.title || 'Sin título')}"`,
            formatDateWithTimezone(conv.createdAt),
            formatDateWithTimezone(conv.updatedAt),
            
            // DATOS DE MENSAJE
            msg.sender || '',
            `"${text}"`,
            msg.isCreatedByUser || false,
            msg.messageId,
            formatDateWithTimezone(msg.createdAt),
            
            // ⭐ FEEDBACK
            `"${serializeFeedback(msg.feedback)}"`
          ];
          
          lines.push(row.join(','));
        });
      });

      fs.writeFileSync(outputFile, lines.join('\n'), 'utf8');
    }

    // Mostrar resumen detallado
    console.purple('----------------------------------------------------');
    console.green('✅ ¡Exportación extendida completada!');
    console.purple('----------------------------------------------------');
    console.cyan(`👥 Total usuarios: ${users.length}`);
    console.cyan(`   - Con teléfono: ${users.filter(u => userMap[u._id.toString()].phone).length}`);
    console.cyan(`   - Con AviRole: ${users.filter(u => userMap[u._id.toString()].aviRole).length}`);
    console.cyan(`   - Con AviSubrole: ${users.filter(u => userMap[u._id.toString()].aviSubrole).length}`);
    console.cyan(`📊 Total conversaciones: ${conversations.length}`);
    console.cyan(`💬 Total mensajes: ${messages.length}`);
    console.cyan(`   - Con feedback: ${messages.filter(m => m.feedback).length}`);
    console.cyan(`📁 Formato: ${format.toUpperCase()}`);
    console.cyan(`💾 Archivo: ${outputFile}`);
    console.cyan(`📅 Fecha: ${new Date().toLocaleString()}`);
    console.purple('----------------------------------------------------');

    silentExit(0);

  } catch (error) {
    console.red('❌ Error durante la exportación:');
    console.red(error.message);
    console.red(error.stack);
    silentExit(1);
  }
})();

process.on('uncaughtException', (err) => {
  if (!err.message.includes('fetch failed')) {
    console.error('Error inesperado:', err);
    process.exit(1);
  }
});
