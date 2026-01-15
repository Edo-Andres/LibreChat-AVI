/**
 * Test script for AVI Roles system
 * This script tests the creation and initialization of AviRol and AviSubrol collections
 */

const mongoose = require('mongoose');
const { createModels, createMethods } = require('@librechat/data-schemas');

// Create models and methods
const models = createModels(mongoose);
const methods = createMethods(mongoose);

async function testAviRolesSystem() {
  try {
    console.log('🚀 Starting AVI Roles System Test...');
    
    // Connect to MongoDB (adjust connection string as needed)
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/LibreChat');
    console.log('✅ Connected to MongoDB');

    // 1. Initialize AVI Roles
    console.log('\n1️⃣ Initializing AVI Roles...');
    await methods.initializeAviRoles();
    const roles = await methods.listAviRoles();
    console.log('📋 Created roles:', roles.map(r => r.name));

    // 2. Initialize AVI Subroles
    console.log('\n2️⃣ Initializing AVI Subroles...');
    await methods.initializeAviSubroles();
    const subroles = await methods.listAviSubroles();
    console.log('📋 Created subroles:');
    subroles.forEach(subrol => {
      console.log(`  - ${subrol.name} (parent: ${subrol.parentRolId?.name || subrol.parentRolId})`);
    });

    // 3. Test role assignment to user (create a test user first)
    console.log('\n3️⃣ Testing user role assignment...');
    
    // Find or create a test user
    let testUser = await methods.findUser({ email: 'test-avi@example.com' });
    if (!testUser) {
      const testUserId = await methods.createUser({ 
        name: 'Test AVI User',
        email: 'test-avi@example.com',
        emailVerified: true,
        password: 'testpassword123'
      });
      console.log('👤 Created test user:', testUserId);
      testUser = await methods.findUser({ email: 'test-avi@example.com' });
    }

    // Get the generico role and one of its subroles
    const genericoRole = await methods.getAviRolByName('generico');
    const genericoSubroles = await methods.getAviSubrolesByParentId(genericoRole._id.toString());
    
    if (genericoRole && genericoSubroles.length > 0) {
      console.log(`🎯 Assigning role "${genericoRole.name}" and subrol "${genericoSubroles[0].name}" to user...`);
      
      const updatedUser = await methods.assignUserAviRoles(
        testUser._id.toString(),
        genericoRole._id.toString(),
        genericoSubroles[0]._id.toString()
      );
      
      console.log('✅ Role assignment successful!');
      
      // 4. Test validation
      console.log('\n4️⃣ Testing role validation...');
      const validation = await methods.validateUserAviRoles(testUser._id.toString());
      console.log('🔍 Validation result:', validation);
      
      // 5. Test getting user with populated roles
      console.log('\n5️⃣ Getting user with populated roles...');
      const userWithRoles = await methods.getUserWithAviRoles(testUser._id.toString());
      console.log('👤 User with roles:', {
        name: userWithRoles.name,
        email: userWithRoles.email,
        aviRol: userWithRoles.aviRol_id,
        aviSubrol: userWithRoles.aviSubrol_id
      });
    }

    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Export for use as a module or run directly
if (require.main === module) {
  testAviRolesSystem();
}

module.exports = { testAviRolesSystem };