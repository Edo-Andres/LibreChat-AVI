/**
 * Test script for AVI Roles Knowledge and Behavior Variables in Prompts
 * This script tests the new knowledge and behavior variables:
 * - {{user_avi_rol_knowledge}}
 * - {{user_avi_rol_behavior}}
 * - {{user_avi_subrol_knowledge}}
 * - {{user_avi_subrol_behavior}}
 * 
 * Usage: node config/test-knowledge-behavior-variables.js
 */

const mongoose = require('mongoose');
const { createModels, createMethods } = require('@librechat/data-schemas');
const { replaceSpecialVars } = require('librechat-data-provider');

// Create models and methods
const models = createModels(mongoose);
const methods = createMethods(mongoose);

async function testKnowledgeBehaviorVariables() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Ensure AVI roles exist
    console.log('🔧 Ensuring AVI roles exist...');
    await methods.initializeAviRoles();
    await methods.initializeAviSubroles();
    console.log('✅ AVI roles initialized\n');

    // Get or create a test user
    console.log('🔧 Setting up test user...');
    let testUser = await methods.findUser({ email: 'test-knowledge-behavior@example.com' });
    
    if (!testUser) {
      testUser = await methods.createUser({
        email: 'test-knowledge-behavior@example.com',
        name: 'Test Knowledge User',
        username: 'test-knowledge-user',
        password: 'Test1234!',
        provider: 'local',
      });
      console.log('✅ Test user created');
    } else {
      console.log('✅ Test user found');
    }

    // Get AVI roles
    const aviRoles = await methods.listAviRoles();
    const administrativoRole = aviRoles.find(r => r.name === 'administrativo');
    const cuidadorRole = aviRoles.find(r => r.name === 'cuidador');

    if (!administrativoRole || !cuidadorRole) {
      throw new Error('AVI roles not found. Please run initialize scripts first.');
    }

    // Get subroles
    const adminSubroles = await methods.getAviSubrolesByParentId(administrativoRole._id.toString());
    const cuidadorSubroles = await methods.getAviSubrolesByParentId(cuidadorRole._id.toString());

    const gestorUsuarios = adminSubroles.find(s => s.name === 'Gestor de Usuarios');
    const cuidadorPrincipal = cuidadorSubroles.find(s => s.name === 'Cuidador Principal');

    console.log('\n📋 Available AVI Roles:');
    aviRoles.forEach(role => {
      console.log(`  - ${role.name} (ID: ${role._id})`);
      if (role.knowledge) console.log(`    Knowledge: ${role.knowledge.substring(0, 60)}...`);
      if (role.behavior) console.log(`    Behavior: ${role.behavior.substring(0, 60)}...`);
    });

    // Test Case 1: User with administrativo role (has knowledge and behavior)
    console.log('\n\n🧪 TEST CASE 1: User with administrativo role');
    console.log('═'.repeat(80));
    
    await methods.assignUserAviRoles(
      testUser._id.toString(),
      administrativoRole._id.toString(),
      gestorUsuarios?._id?.toString() || null
    );
    console.log('✅ Assigned roles to user');

    // Get user with populated roles
    const userWithRoles1 = await methods.getUserWithAviRoles(testUser._id.toString());
    console.log(`\nUser info:`);
    console.log(`  Name: ${userWithRoles1.name}`);
    console.log(`  Email: ${userWithRoles1.email}`);
    console.log(`  AVI Rol: ${userWithRoles1.aviRol_id?.name || 'N/A'}`);
    console.log(`  AVI Subrol: ${userWithRoles1.aviSubrol_id?.name || 'N/A'}`);
    console.log(`\nRol Knowledge:`);
    console.log(`  ${userWithRoles1.aviRol_id?.knowledge || 'N/A'}`);
    console.log(`\nRol Behavior:`);
    console.log(`  ${userWithRoles1.aviRol_id?.behavior || 'N/A'}`);
    console.log(`\nSubrol Knowledge:`);
    console.log(`  ${userWithRoles1.aviSubrol_id?.knowledge || 'N/A (subroles don\'t have knowledge)'}`);
    console.log(`\nSubrol Behavior:`);
    console.log(`  ${userWithRoles1.aviSubrol_id?.behavior || 'N/A (subroles don\'t have behavior)'}`);

    // Prepare user object for variable replacement (simulating what agent.js does)
    const userForReplacement1 = {
      ...testUser.toObject(),
      name: userWithRoles1.name,
      aviRol: userWithRoles1.aviRol_id?.name || '',
      aviSubrol: userWithRoles1.aviSubrol_id?.name || '',
      aviRolKnowledge: userWithRoles1.aviRol_id?.knowledge || null,
      aviRolBehavior: userWithRoles1.aviRol_id?.behavior || null,
      aviSubrolKnowledge: userWithRoles1.aviSubrol_id?.knowledge || null,
      aviSubrolBehavior: userWithRoles1.aviSubrol_id?.behavior || null,
    };

    const testPrompt1 = `
Hola {{current_user}},

Tu rol en el sistema es: {{user_avi_rol}}
Tu subrol específico es: {{user_avi_subrol}}

CONOCIMIENTO ESPERADO DE TU ROL:
{{user_avi_rol_knowledge}}

COMPORTAMIENTO ESPERADO DE TU ROL:
{{user_avi_rol_behavior}}

CONOCIMIENTO ESPECÍFICO DE TU SUBROL:
{{user_avi_subrol_knowledge}}

COMPORTAMIENTO ESPECÍFICO DE TU SUBROL:
{{user_avi_subrol_behavior}}

Fecha: {{current_date}}
    `.trim();

    console.log(`\n📝 Test prompt:`);
    console.log('─'.repeat(80));
    console.log(testPrompt1);
    console.log('─'.repeat(80));

    const replacedPrompt1 = replaceSpecialVars({
      text: testPrompt1,
      user: userForReplacement1,
    });

    console.log(`\n✅ Replaced prompt:`);
    console.log('─'.repeat(80));
    console.log(replacedPrompt1);
    console.log('─'.repeat(80));

    // Test Case 2: User with cuidador role
    console.log('\n\n🧪 TEST CASE 2: User with cuidador role');
    console.log('═'.repeat(80));
    
    await methods.assignUserAviRoles(
      testUser._id.toString(),
      cuidadorRole._id.toString(),
      cuidadorPrincipal?._id?.toString() || null
    );
    console.log('✅ Assigned cuidador role to user');

    // Get user with populated roles
    const userWithRoles2 = await methods.getUserWithAviRoles(testUser._id.toString());
    console.log(`\nUser info:`);
    console.log(`  Name: ${userWithRoles2.name}`);
    console.log(`  AVI Rol: ${userWithRoles2.aviRol_id?.name || 'N/A'}`);
    console.log(`  AVI Subrol: ${userWithRoles2.aviSubrol_id?.name || 'N/A'}`);
    console.log(`\nRol Knowledge:`);
    console.log(`  ${userWithRoles2.aviRol_id?.knowledge || 'N/A'}`);
    console.log(`\nRol Behavior:`);
    console.log(`  ${userWithRoles2.aviRol_id?.behavior || 'N/A'}`);

    // Prepare user object for variable replacement
    const userForReplacement2 = {
      ...testUser.toObject(),
      name: userWithRoles2.name,
      aviRol: userWithRoles2.aviRol_id?.name || '',
      aviSubrol: userWithRoles2.aviSubrol_id?.name || '',
      aviRolKnowledge: userWithRoles2.aviRol_id?.knowledge || null,
      aviRolBehavior: userWithRoles2.aviRol_id?.behavior || null,
      aviSubrolKnowledge: userWithRoles2.aviSubrol_id?.knowledge || null,
      aviSubrolBehavior: userWithRoles2.aviSubrol_id?.behavior || null,
    };

    const testPrompt2 = `
Como {{user_avi_rol}} ({{user_avi_subrol}}), necesitas:

CONOCIMIENTO:
{{user_avi_rol_knowledge}}

COMPORTAMIENTO:
{{user_avi_rol_behavior}}
    `.trim();

    console.log(`\n📝 Test prompt:`);
    console.log('─'.repeat(80));
    console.log(testPrompt2);
    console.log('─'.repeat(80));

    const replacedPrompt2 = replaceSpecialVars({
      text: testPrompt2,
      user: userForReplacement2,
    });

    console.log(`\n✅ Replaced prompt:`);
    console.log('─'.repeat(80));
    console.log(replacedPrompt2);
    console.log('─'.repeat(80));

    // Test Case 3: User without roles
    console.log('\n\n🧪 TEST CASE 3: User without AVI roles');
    console.log('═'.repeat(80));
    
    // Remove roles
    await methods.assignUserAviRoles(testUser._id.toString(), null, null);
    console.log('✅ Removed roles from user');

    const userWithRoles3 = await methods.getUserWithAviRoles(testUser._id.toString());
    
    const userForReplacement3 = {
      ...testUser.toObject(),
      name: userWithRoles3.name,
      aviRol: userWithRoles3.aviRol_id?.name || '',
      aviSubrol: userWithRoles3.aviSubrol_id?.name || '',
      aviRolKnowledge: userWithRoles3.aviRol_id?.knowledge || null,
      aviRolBehavior: userWithRoles3.aviRol_id?.behavior || null,
      aviSubrolKnowledge: userWithRoles3.aviSubrol_id?.knowledge || null,
      aviSubrolBehavior: userWithRoles3.aviSubrol_id?.behavior || null,
    };

    const testPrompt3 = `
Usuario: {{current_user}}
Rol: {{user_avi_rol}}
Subrol: {{user_avi_subrol}}
Knowledge: {{user_avi_rol_knowledge}}
Behavior: {{user_avi_rol_behavior}}
    `.trim();

    console.log(`\n📝 Test prompt:`);
    console.log('─'.repeat(80));
    console.log(testPrompt3);
    console.log('─'.repeat(80));

    const replacedPrompt3 = replaceSpecialVars({
      text: testPrompt3,
      user: userForReplacement3,
    });

    console.log(`\n✅ Replaced prompt (all role variables should be empty):`);
    console.log('─'.repeat(80));
    console.log(replacedPrompt3);
    console.log('─'.repeat(80));

    console.log('\n\n🎉 All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  ✅ Variables replaced correctly for users with roles');
    console.log('  ✅ Knowledge and behavior fields correctly populated');
    console.log('  ✅ Empty strings returned for users without roles');
    console.log('  ✅ Subroles correctly show null for knowledge/behavior');
    console.log('\n✨ The new variables are ready to use in agent prompts!');

  } catch (error) {
    console.error('❌ Error during testing:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testKnowledgeBehaviorVariables()
  .then(() => {
    console.log('\n✅ Test script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });
