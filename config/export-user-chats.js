const path = require('path');
const fs = require('fs');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { askQuestion, silentExit } = require('./helpers');
const { Conversation, Message } = require('~/db/models');
const { User } = require('~/db/models');
const connect = require('./connect');

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
 * Genera CSV de las conversaciones
 */
function generateCSV(userEmail, conversations, messages) {
  const lines = [
    'userEmail,conversationId,conversationTitle,sender,text,isCreatedByUser,error,unfinished,messageId,parentMessageId,createdAt',
  ];

  conversations.forEach((conv) => {
    const convMessages = messages.filter((msg) => msg.conversationId === conv.conversationId);

    convMessages.forEach((msg) => {
      let text = msg.text || extractTextFromContent(msg.content);
      text = cleanTextForCSV(text);

      const row = [
        userEmail,
        conv.conversationId,
        `"${cleanTextForCSV(conv.title || 'Sin título')}"`,
        msg.sender || '',
        `"${text}"`,
        msg.isCreatedByUser || false,
        msg.error || false,
        msg.unfinished || false,
        msg.messageId,
        msg.parentMessageId || '',
        msg.createdAt ? msg.createdAt.toISOString() : '',
      ];
      lines.push(row.join(','));
    });
  });

  return lines.join('\n');
}

/**
 * Genera JSON de las conversaciones
 */
function generateJSON(userEmail, conversations, messages) {
  const result = {
    userEmail,
    exportDate: new Date().toISOString(),
    totalConversations: conversations.length,
    totalMessages: messages.length,
    conversations: [],
  };

  conversations.forEach((conv) => {
    const convMessages = messages
      .filter((msg) => msg.conversationId === conv.conversationId)
      .map((msg) => ({
        messageId: msg.messageId,
        sender: msg.sender || '',
        text: msg.text || extractTextFromContent(msg.content),
        isCreatedByUser: msg.isCreatedByUser || false,
        createdAt: msg.createdAt,
        parentMessageId: msg.parentMessageId || '',
      }));

    result.conversations.push({
      conversationId: conv.conversationId,
      title: conv.title || 'Sin título',
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messageCount: convMessages.length,
      messages: convMessages,
    });
  });

  return JSON.stringify(result, null, 2);
}

(async () => {
  await connect();

  console.purple('----------------------------------------');
  console.purple('🗂️  Exportar Conversaciones de Usuario');
  console.purple('----------------------------------------');

  if (process.argv.length < 3) {
    console.orange('Uso: npm run export-user-chats <email> [formato] [archivo]');
    console.orange('Formatos: csv, json (por defecto: csv)');
    console.orange('Ejemplo: npm run export-user-chats usuario@ejemplo.com csv conversaciones.csv');
    console.purple('----------------------------------------');
  }

  // Obtener parámetros
  let email = process.argv[2];
  let format = process.argv[3] || 'csv';
  let outputFile = process.argv[4];

  // Solicitar email si no se proporcionó
  if (!email) {
    email = await askQuestion('Email del usuario:');
  }

  // Validar email
  if (!email || !email.includes('@')) {
    console.red('❌ Error: Email inválido');
    silentExit(1);
  }

  // Validar formato
  if (!['csv', 'json'].includes(format.toLowerCase())) {
    console.red('❌ Error: Formato debe ser csv o json');
    silentExit(1);
  }
  format = format.toLowerCase();

  try {
    console.orange('🔍 Buscando usuario...');

    // Buscar usuario
    const user = await User.findOne({ email }).lean();
    if (!user) {
      console.red(`❌ Usuario con email "${email}" no encontrado`);

      // Mostrar usuarios disponibles
      const allUsers = await User.find({}, 'email name').limit(10).lean();
      if (allUsers.length > 0) {
        console.cyan('\n📋 Algunos usuarios disponibles:');
        allUsers.forEach((u) => console.cyan(`   • ${u.email} ${u.name ? `(${u.name})` : ''}`));
      }
      silentExit(1);
    }

    console.green(`✅ Usuario encontrado: ${user.email}`);
    console.orange('📂 Obteniendo conversaciones...');

    // Obtener conversaciones (usando string ID como vimos en el diagnóstico)
    const conversations = await Conversation.find({ user: user._id.toString() })
      .sort({ updatedAt: -1 })
      .lean();

    if (conversations.length === 0) {
      console.yellow('⚠️  El usuario no tiene conversaciones');
      silentExit(0);
    }

    console.green(`✅ Encontradas ${conversations.length} conversaciones`);
    console.orange('💬 Obteniendo mensajes...');

    // Obtener todos los mensajes de las conversaciones
    const conversationIds = conversations.map((conv) => conv.conversationId);
    const messages = await Message.find({
      conversationId: { $in: conversationIds },
      user: user._id.toString(),
    })
      .sort({ createdAt: 1 })
      .lean();

    console.green(`✅ Encontrados ${messages.length} mensajes`);
    console.orange('📝 Generando exportación...');

    // Generar contenido según formato
    let content;
    let defaultFileName;

    if (format === 'json') {
      content = generateJSON(user.email, conversations, messages);
      defaultFileName = `conversaciones_${user.email.replace('@', '_at_').replace(/\./g, '_')}.json`;
    } else {
      content = generateCSV(user.email, conversations, messages);
      defaultFileName = `conversaciones_${user.email.replace('@', '_at_').replace(/\./g, '_')}.csv`;
    }

    // Determinar archivo de salida
    if (!outputFile) {
      outputFile = defaultFileName;
    }

    // Guardar archivo
    fs.writeFileSync(outputFile, content, 'utf8');

    // Mostrar resumen
    console.purple('----------------------------------------');
    console.green('✅ ¡Exportación completada exitosamente!');
    console.purple('----------------------------------------');
    console.cyan(`👤 Usuario: ${user.email}`);
    console.cyan(`📊 Conversaciones: ${conversations.length}`);
    console.cyan(`💬 Mensajes: ${messages.length}`);
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
