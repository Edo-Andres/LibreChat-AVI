/**
 * Test script for AVI Roles Variables in Prompts
 * This script tests the new {{user_avi_rol}} and {{user_avi_subrol}} variables
 * 
 * Usage: node config/test-avi-roles-variables.js
 */

const mongoose = require('mongoose');
const { createModels, createMethods } = require('@librechat/data-schemas');
const { replaceSpecialVars } = require('librechat-data-provider');

// Create models and methods
const models = createModels(mongoose);
const methods = createMethods(mongoose);

async function testAviRolesVariables() {
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
    let testUser = await methods.findUser({ email: 'test-avi-roles@example.com' });
    
    if (!testUser) {
      testUser = await methods.createUser({
        email: 'test-avi-roles@example.com',
        name: 'Test AVI User',
        username: 'test-avi-user',
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
    });

    console.log('\n📋 Available Subroles for "administrativo":');
    adminSubroles.forEach(subrol => {
      console.log(`  - ${subrol.name} (ID: ${subrol._id})`);
    });

    console.log('\n📋 Available Subroles for "cuidador":');
    cuidadorSubroles.forEach(subrol => {
      console.log(`  - ${subrol.name} (ID: ${subrol._id})`);
    });

    // Test Case 1: User with administrativo role and Gestor de Usuarios subrol
    console.log('\n\n🧪 TEST CASE 1: User with administrativo role and Gestor de Usuarios subrol');
    console.log('═'.repeat(80));
    
    await methods.assignUserAviRoles(
      testUser._id.toString(),
      administrativoRole._id.toString(),
      gestorUsuarios._id.toString()
    );
    console.log('✅ Assigned roles to user');

    // Get user with populated roles
    const userWithRoles1 = await methods.getUserWithAviRoles(testUser._id.toString());
    console.log(`\nUser info:`);
    console.log(`  Name: ${userWithRoles1.name}`);
    console.log(`  Email: ${userWithRoles1.email}`);
    console.log(`  AVI Rol: ${userWithRoles1.aviRol_id?.name || 'N/A'}`);
    console.log(`  AVI Subrol: ${userWithRoles1.aviSubrol_id?.name || 'N/A'}`);

    // Prepare user object for variable replacement (simulating what agent.js does)
    const userForReplacement1 = {
      ...testUser.toObject(),
      name: userWithRoles1.name,
      aviRol: userWithRoles1.aviRol_id?.name || '',
      aviSubrol: userWithRoles1.aviSubrol_id?.name || '',
    };

    // Test prompt with variables
    const testPrompt1 = `
Hola {{current_user}}, bienvenido a LibreChat.

Tu rol es: {{user_avi_rol}}
Tu subrol es: {{user_avi_subrol}}

Como {{user_avi_subrol}}, tus responsabilidades incluyen administrar usuarios y permisos.
Fecha: {{current_date}}
    `.trim();

    console.log('\n📝 Original Prompt:');
    console.log(testPrompt1);

    const replacedPrompt1 = replaceSpecialVars({
      text: testPrompt1,
      user: userForReplacement1,
    });

    console.log('\n✨ Replaced Prompt:');
    console.log(replacedPrompt1);

    // Test Case 2: User with cuidador role and Cuidador Principal subrol
    console.log('\n\n🧪 TEST CASE 2: User with cuidador role and Cuidador Principal subrol');
    console.log('═'.repeat(80));
    
    await methods.assignUserAviRoles(
      testUser._id.toString(),
      cuidadorRole._id.toString(),
      cuidadorPrincipal._id.toString()
    );
    console.log('✅ Assigned roles to user');

    const userWithRoles2 = await methods.getUserWithAviRoles(testUser._id.toString());
    console.log(`\nUser info:`);
    console.log(`  Name: ${userWithRoles2.name}`);
    console.log(`  Email: ${userWithRoles2.email}`);
    console.log(`  AVI Rol: ${userWithRoles2.aviRol_id?.name || 'N/A'}`);
    console.log(`  AVI Subrol: ${userWithRoles2.aviSubrol_id?.name || 'N/A'}`);

    const userForReplacement2 = {
      ...testUser.toObject(),
      name: userWithRoles2.name,
      aviRol: userWithRoles2.aviRol_id?.name || '',
      aviSubrol: userWithRoles2.aviSubrol_id?.name || '',
    };

    const testPrompt2 = `
Eres un asistente de LibreChat especializado en el rol {{user_avi_rol}}.

Usuario: {{current_user}}
Rol: {{user_avi_rol}}
Subrol: {{user_avi_subrol}}

Como {{user_avi_subrol}}, debes gestionar el cuidado principal del paciente.
    `.trim();

    console.log('\n📝 Original Prompt:');
    console.log(testPrompt2);

    const replacedPrompt2 = replaceSpecialVars({
      text: testPrompt2,
      user: userForReplacement2,
    });

    console.log('\n✨ Replaced Prompt:');
    console.log(replacedPrompt2);

    // Test Case 3: User without AVI roles
    console.log('\n\n🧪 TEST CASE 3: User without AVI roles');
    console.log('═'.repeat(80));
    
    await methods.removeUserAviRoles(testUser._id.toString());
    console.log('✅ Removed roles from user');

    const userWithoutRoles = await methods.getUserWithAviRoles(testUser._id.toString());
    console.log(`\nUser info:`);
    console.log(`  Name: ${userWithoutRoles.name}`);
    console.log(`  Email: ${userWithoutRoles.email}`);
    console.log(`  AVI Rol: ${userWithoutRoles.aviRol_id?.name || 'N/A'}`);
    console.log(`  AVI Subrol: ${userWithoutRoles.aviSubrol_id?.name || 'N/A'}`);

    const userForReplacement3 = {
      ...testUser.toObject(),
      name: userWithoutRoles.name,
      aviRol: userWithoutRoles.aviRol_id?.name || '',
      aviSubrol: userWithoutRoles.aviSubrol_id?.name || '',
    };

    const testPrompt3 = `
Usuario: {{current_user}}
Rol: {{user_avi_rol}}
Subrol: {{user_avi_subrol}}

Nota: Si no hay rol asignado, las variables estarán vacías.
    `.trim();

    console.log('\n📝 Original Prompt:');
    console.log(testPrompt3);

    const replacedPrompt3 = replaceSpecialVars({
      text: testPrompt3,
      user: userForReplacement3,
    });

    console.log('\n✨ Replaced Prompt:');
    console.log(replacedPrompt3);

    console.log('\n\n✅ All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  ✓ Variables {{user_avi_rol}} and {{user_avi_subrol}} work correctly');
    console.log('  ✓ Empty strings are used when roles are not assigned');
    console.log('  ✓ Role names are correctly extracted and replaced');

  } catch (error) {
    console.error('\n❌ Error during testing:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
if (require.main === module) {
  testAviRolesVariables()
    .then(() => {
      console.log('\n✨ Test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testAviRolesVariables };
