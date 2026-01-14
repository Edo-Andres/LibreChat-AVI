const path = require('path');
const mongoose = require('mongoose');
const {
  Conversation,
  Message,
  ToolCall,
  User
} = require('@librechat/data-schemas').createModels(mongoose);
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const connect = require('./connect');

// Configuración de antigüedad
const parseDaysArg = () => {
  const daysIndex = process.argv.indexOf('--days');
  if (daysIndex !== -1 && process.argv[daysIndex + 1]) {
    const d = parseInt(process.argv[daysIndex + 1], 10);
    if (!isNaN(d) && d > 0) return d;
  }
  return 30; // Valor por defecto
};

const DAYS_OLD = parseDaysArg();

async function cleanupOldConversations() {
  try {
    // Conexión a la base de datos
    await connect();

    // Calcular fecha de corte
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_OLD);

    console.log(`\n🔍 Buscando conversaciones inactivas desde: ${cutoffDate.toISOString()}`);
    console.log(`   (Criterio: 'updatedAt' <= ${DAYS_OLD} días)`);

    // Verificar modo de ejecución
    const isDryRun = !process.argv.includes('--force');

    // Query: buscar conversaciones cuya última actualización sea anterior o igual a la fecha de corte
    const query = { updatedAt: { $lte: cutoffDate } };
    
    // Proyección ligera para listar
    const conversations = await Conversation.find(query).select('conversationId title updatedAt user');
    const count = conversations.length;

    console.log(`📊 Se encontraron ${count} conversaciones inactivas.`);

    if (count === 0) {
      console.log('✅ No hay nada que limpiar. Todo está fresco.');
      process.exit(0);
    }

    if (isDryRun) {
      console.log('\n⚠️  MODO SIMULACRO (DRY RUN) ⚠️');
      console.log('ℹ️  No se ha borrado nada. Para borrar realmente, ejecuta el script con: --force');

      // Resumen por usuario
      console.log('\n👥 Resumen de chats por Usuario:');
      const userCounts = conversations.reduce((acc, c) => {
        acc[c.user] = (acc[c.user] || 0) + 1;
        return acc;
      }, {});

      // Obtener emails de los usuarios
      const userIds = Object.keys(userCounts);
      const users = await User.find({ _id: { $in: userIds } }).select('email').lean();
      const emailMap = users.reduce((acc, u) => {
        acc[u._id.toString()] = u.email;
        return acc;
      }, {});

      Object.entries(userCounts)
        .sort((a, b) => b[1] - a[1]) // Ordenar de mayor a menor cantidad
        .forEach(([userId, count]) => {
          const email = emailMap[userId] || 'Email no encontrado';
          console.log(`   - Usuario: ${email} (ID: ${userId}) -> ${count} chats`);
        });

      console.log('\n📜 Ejemplos de chats que SE BORRARÍAN:');
      
      const sample = conversations.slice(0, 10);

      sample.forEach((c, i) => {
        const email = emailMap[c.user] || 'Email no encontrado';
        console.log(`   ${i + 1}. [${email}] [${c.updatedAt.toISOString().split('T')[0]}] "${c.title}"`);
      });
      
      if (count > 10) console.log(`   ... y ${count - 10} conversaciones más.`);
      
    } else {
      console.log('\n🗑️  INICIANDO LIMPIEZA REAL...');
      
      const conversationIds = conversations.map(c => c.conversationId);
      
      console.log('   1. Eliminando mensajes...');
      const msgs = await Message.deleteMany({ conversationId: { $in: conversationIds } });
      console.log(`      -> ${msgs.deletedCount} mensajes eliminados.`);

      console.log('   2. Eliminando tool calls (agentes)...');
      const tools = await ToolCall.deleteMany({ conversationId: { $in: conversationIds } });
      console.log(`      -> ${tools.deletedCount} tool calls eliminados.`);

      console.log('   3. Eliminando conversaciones...');
      const convos = await Conversation.deleteMany({ conversationId: { $in: conversationIds } });
      console.log(`      -> ${convos.deletedCount} conversaciones eliminadas.`);

      console.log('\n🎉 Limpieza completada con éxito.');
    }

  } catch (error) {
    console.error('\n❌ Ocurrió un error durante la limpieza:', error);
    process.exit(1);
  } finally {
    // Cerrar conexión limpiamente
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    } catch (e) {}
    process.exit(0);
  }
}

cleanupOldConversations();
