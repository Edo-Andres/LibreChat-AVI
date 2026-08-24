/**
 * Migration script for AVI Roles system
 * This script:
 * 1. Ensures AVI roles and subroles are initialized
 * 2. Validates existing user AVI role assignments
 * 3. Reports any inconsistencies
 */

const mongoose = require('mongoose');
const { createModels, createMethods } = require('@librechat/data-schemas');

// Create models and methods
const models = createModels(mongoose);
const methods = createMethods(mongoose);

async function migrateAviRoles() {
  try {
    console.log('🚀 Starting AVI Roles Migration...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/LibreChat');
    console.log('✅ Connected to MongoDB');

    // 1. Initialize roles and subroles if they don't exist
    console.log('\n1️⃣ Ensuring AVI Roles are initialized...');
    await methods.initializeAviRoles();
    await methods.initializeAviSubroles();

    const roles = await methods.listAviRoles();
    const subroles = await methods.listAviSubroles();
    console.log(`📊 Found ${roles.length} roles and ${subroles.length} subroles`);

    // 2. Check all users with AVI role assignments
    console.log('\n2️⃣ Validating existing user role assignments...');
    const User = mongoose.models.User;

    // Find users with AVI role assignments
    const usersWithAviRoles = await User.find({
      $or: [
        { aviRol_id: { $exists: true, $ne: null } },
        { aviSubrol_id: { $exists: true, $ne: null } },
      ],
    }).lean();

    console.log(`👥 Found ${usersWithAviRoles.length} users with AVI role assignments`);

    let validUsers = 0;
    let invalidUsers = [];

    for (const user of usersWithAviRoles) {
      const validation = await methods.validateUserAviRoles(user._id.toString());

      if (validation.isValid) {
        validUsers++;
      } else {
        invalidUsers.push({
          userId: user._id,
          email: user.email,
          error: validation.error,
        });
      }
    }

    console.log(`✅ Valid assignments: ${validUsers}`);
    console.log(`❌ Invalid assignments: ${invalidUsers.length}`);

    if (invalidUsers.length > 0) {
      console.log('\n🔍 Invalid assignments details:');
      invalidUsers.forEach((invalid, index) => {
        console.log(`  ${index + 1}. User: ${invalid.email} (${invalid.userId})`);
        console.log(`     Error: ${invalid.error}`);
      });
    }

    // 3. Summary
    console.log('\n📊 Migration Summary:');
    console.log(`  - AVI Roles: ${roles.map((r) => r.name).join(', ')}`);
    console.log(`  - Total Subroles: ${subroles.length}`);
    console.log(`  - Users with assignments: ${usersWithAviRoles.length}`);
    console.log(`  - Valid assignments: ${validUsers}`);
    console.log(`  - Invalid assignments: ${invalidUsers.length}`);

    if (invalidUsers.length === 0) {
      console.log('\n🎉 All user assignments are valid!');
    } else {
      console.log('\n⚠️  Some assignments need attention. Consider running repair operations.');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Export for use as a module or run directly
if (require.main === module) {
  migrateAviRoles();
}

module.exports = { migrateAviRoles };
