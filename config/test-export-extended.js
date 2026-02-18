/**
 * Script de prueba para verificar que los datos necesarios están disponibles
 * Ejecutar: node config/test-export-extended.js
 */

const path = require('path');
const mongoose = require('mongoose');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const connect = require('./connect');
const { User, Conversation, Message } = require('@librechat/data-schemas').createModels(mongoose);

(async () => {
  try {
    console.log('🔍 Verificando datos disponibles para exportación extendida...\n');
    
    await connect();

    // 1. Verificar Usuarios
    console.log('═'.repeat(80));
    console.log('👥 USUARIOS');
    console.log('═'.repeat(80));
    
    const totalUsers = await User.countDocuments();
    const usersWithPhone = await User.countDocuments({ phone: { $exists: true, $ne: null, $ne: "" } });
    const usersWithAviRole = await User.countDocuments({ aviRol_id: { $exists: true, $ne: null } });
    const usersWithAviSubrole = await User.countDocuments({ aviSubrol_id: { $exists: true, $ne: null } });
    
    console.log(`Total usuarios: ${totalUsers}`);
    console.log(`  - Con teléfono: ${usersWithPhone} (${((usersWithPhone/totalUsers)*100).toFixed(1)}%)`);
    console.log(`  - Con AviRole: ${usersWithAviRole} (${((usersWithAviRole/totalUsers)*100).toFixed(1)}%)`);
    console.log(`  - Con AviSubrole: ${usersWithAviSubrole} (${((usersWithAviSubrole/totalUsers)*100).toFixed(1)}%)`);
    
    // Sample user con populate
    const sampleUser = await User.findOne()
      .populate('aviRol_id', 'name')
      .populate('aviSubrol_id', 'name')
      .select('email name phone aviRol_id aviSubrol_id createdAt')
      .lean();
    
    if (sampleUser) {
      console.log('\n📋 Ejemplo de usuario:');
      console.log({
        email: sampleUser.email,
        name: sampleUser.name,
        phone: sampleUser.phone || '(vacío)',
        aviRole: sampleUser.aviRol_id?.name || '(no asignado)',
        aviSubrole: sampleUser.aviSubrol_id?.name || '(no asignado)',
        createdAt: sampleUser.createdAt
      });
    }

    // 2. Verificar Conversaciones
    console.log('\n' + '═'.repeat(80));
    console.log('💬 CONVERSACIONES');
    console.log('═'.repeat(80));
    
    const totalConvos = await Conversation.countDocuments();
    const convosWithDates = await Conversation.countDocuments({ 
      createdAt: { $exists: true },
      updatedAt: { $exists: true }
    });
    
    console.log(`Total conversaciones: ${totalConvos}`);
    console.log(`  - Con fechas completas: ${convosWithDates} (${((convosWithDates/totalConvos)*100).toFixed(1)}%)`);
    
    const sampleConvo = await Conversation.findOne()
      .select('conversationId title user createdAt updatedAt')
      .lean();
    
    if (sampleConvo) {
      console.log('\n📋 Ejemplo de conversación:');
      console.log({
        conversationId: sampleConvo.conversationId,
        title: sampleConvo.title,
        createdAt: sampleConvo.createdAt,
        updatedAt: sampleConvo.updatedAt,
        duration: sampleConvo.updatedAt && sampleConvo.createdAt 
          ? `${Math.round((sampleConvo.updatedAt - sampleConvo.createdAt) / (1000 * 60 * 60 * 24))} días`
          : 'N/A'
      });
    }

    // 3. Verificar Mensajes
    console.log('\n' + '═'.repeat(80));
    console.log('📝 MENSAJES');
    console.log('═'.repeat(80));
    
    const totalMessages = await Message.countDocuments();
    const messagesWithFeedback = await Message.countDocuments({ feedback: { $exists: true, $ne: null } });
    
    console.log(`Total mensajes: ${totalMessages}`);
    console.log(`  - Con feedback: ${messagesWithFeedback} (${((messagesWithFeedback/totalMessages)*100).toFixed(1)}%)`);
    
    if (messagesWithFeedback > 0) {
      const sampleFeedback = await Message.findOne({ feedback: { $exists: true } })
        .select('messageId sender text feedback')
        .lean();
      
      if (sampleFeedback) {
        console.log('\n📋 Ejemplo de mensaje con feedback:');
        console.log({
          messageId: sampleFeedback.messageId,
          sender: sampleFeedback.sender,
          text: (sampleFeedback.text || '').substring(0, 50) + '...',
          feedback: sampleFeedback.feedback
        });
      }
    } else {
      console.log('\n⚠️ No hay mensajes con feedback todavía');
    }

    // 4. Verificar AviRoles
    console.log('\n' + '═'.repeat(80));
    console.log('🎭 AVI ROLES & SUBROLES');
    console.log('═'.repeat(80));
    
    const AviRol = mongoose.models.AviRol;
    const AviSubrol = mongoose.models.AviSubrol;
    
    const totalAviRoles = await AviRol.countDocuments();
    const totalAviSubroles = await AviSubrol.countDocuments();
    
    console.log(`Total AviRoles: ${totalAviRoles}`);
    console.log(`Total AviSubroles: ${totalAviSubroles}`);
    
    if (totalAviRoles > 0) {
      const aviRoles = await AviRol.find({}, 'name').lean();
      console.log('\n📋 Roles disponibles:');
      aviRoles.forEach(role => console.log(`  - ${role.name}`));
    }

    // 5. Resumen Final
    console.log('\n' + '═'.repeat(80));
    console.log('✅ RESUMEN');
    console.log('═'.repeat(80));
    
    const readyForExport = totalUsers > 0 && totalConvos > 0 && totalMessages > 0;
    
    if (readyForExport) {
      console.log('✅ Datos disponibles para exportación extendida');
      console.log('\n📊 Columnas que se exportarán:');
      console.log('   1. userEmail');
      console.log('   2. userName');
      console.log(`   3. userPhone (${usersWithPhone} usuarios tienen teléfono)`);
      console.log(`   4. userAviRole (${usersWithAviRole} usuarios tienen rol)`);
      console.log(`   5. userAviSubrole (${usersWithAviSubrole} usuarios tienen subrol)`);
      console.log('   6. userCreatedAt');
      console.log('   7. conversationId');
      console.log('   8. conversationTitle');
      console.log('   9. conversationCreatedAt');
      console.log('  10. conversationUpdatedAt');
      console.log('  11. sender');
      console.log('  12. text');
      console.log('  13. isCreatedByUser');
      console.log('  14. messageId');
      console.log('  15. messageCreatedAt');
      console.log(`  16. feedback (${messagesWithFeedback} mensajes tienen feedback)`);
      
      console.log('\n🚀 Para exportar ejecuta:');
      console.log('   npm run sync-chats-extended');
    } else {
      console.log('❌ No hay suficientes datos para exportar');
      console.log(`   - Usuarios: ${totalUsers}`);
      console.log(`   - Conversaciones: ${totalConvos}`);
      console.log(`   - Mensajes: ${totalMessages}`);
    }
    
    console.log('\n' + '═'.repeat(80));

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
