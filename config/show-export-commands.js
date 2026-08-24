const path = require('path');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { silentExit } = require('./helpers');
const { User } = require('~/db/models');
const { Conversation, Message } = require('~/db/models');
const connect = require('./connect');

(async () => {
  try {
    await connect();

    console.purple('========================================');
    console.purple('📋 COMANDOS DE EXPORTACIÓN DISPONIBLES');
    console.purple('========================================');

    // Obtener estadísticas básicas
    const userCount = await User.countDocuments();
    const conversationCount = await Conversation.countDocuments();
    const messageCount = await Message.countDocuments();

    console.cyan('\n📊 ESTADÍSTICAS DEL SISTEMA:');
    console.cyan(`   👥 Total usuarios: ${userCount}`);
    console.cyan(`   💬 Total conversaciones: ${conversationCount}`);
    console.cyan(`   📝 Total mensajes: ${messageCount}`);

    console.green('\n🚀 COMANDOS DISPONIBLES:');
    console.white('\n1️⃣  Exportar conversaciones de UN usuario específico:');
    console.orange('   cd api');
    console.orange('   npm run export-user-chats <email> [csv|json] [archivo]');
    console.gray('   Ejemplos:');
    console.gray('     npm run export-user-chats usuario@ejemplo.com');
    console.gray('     npm run export-user-chats usuario@ejemplo.com json');
    console.gray('     npm run export-user-chats usuario@ejemplo.com csv mis_chats.csv');

    console.white('\n2️⃣  Exportar TODAS las conversaciones:');
    console.orange('   cd api');
    console.orange('   npm run export-all-chats [csv|json] [archivo]');
    console.gray('   Ejemplos:');
    console.gray('     npm run export-all-chats');
    console.gray('     npm run export-all-chats json');
    console.gray('     npm run export-all-chats csv backup_completo.csv');

    console.white('\n3️⃣  Ver estadísticas de usuarios:');
    console.orange('   cd api');
    console.orange('   npm run user-stats');

    console.white('\n4️⃣  Listar usuarios disponibles:');
    console.orange('   cd api');
    console.orange('   node ../config/list-users.js');

    // Mostrar algunos usuarios de ejemplo si existen
    if (userCount > 0) {
      console.cyan('\n👤 USUARIOS DISPONIBLES (primeros 5):');
      const sampleUsers = await User.find({}, 'email name').limit(5).lean();
      sampleUsers.forEach((user, index) => {
        console.gray(`   ${index + 1}. ${user.email} ${user.name ? `(${user.name})` : ''}`);
      });

      if (userCount > 5) {
        console.gray(`   ... y ${userCount - 5} usuarios más`);
      }
    }

    console.purple('\n========================================');
    console.green('✅ Sistema configurado correctamente');
    console.purple('📖 Ver documentación: config/README_EXPORT_CHATS.md');
    console.purple('========================================\n');

    silentExit(0);
  } catch (error) {
    console.red('❌ Error verificando configuración:');
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
