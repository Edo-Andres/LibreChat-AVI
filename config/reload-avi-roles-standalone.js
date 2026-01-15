#!/usr/bin/env node
/**
 * Script standalone para recargar AVI Roles en desarrollo local
 * No requiere que el servidor esté corriendo
 * Uso: node config/reload-avi-roles-standalone.js [--interactive]
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const mongoose = require('mongoose');

// Setup module alias ANTES de importar otros módulos
require('module-alias')({ base: path.resolve(__dirname, '..') });

const INTERACTIVE = process.argv.includes('--interactive') || process.argv.includes('-i');

console.log('🔄 Recargando configuración AVI Roles - Modo Desarrollo Local');
console.log('═'.repeat(60));

/**
 * Lee librechat.yaml directamente
 */
function readLibreChatConfig() {
  try {
    const configPath = path.join(__dirname, '../librechat.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents);
    return config;
  } catch (error) {
    console.error('❌ Error leyendo librechat.yaml:', error.message);
    return null;
  }
}

/**
 * Conecta a MongoDB
 */
async function connectToMongoDB() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat';
    console.log(`\n🔌 Conectando a MongoDB: ${mongoUri}`);
    
    await mongoose.connect(mongoUri, {
      bufferCommands: false,
      autoIndex: false,
      autoCreate: false,
    });
    
    console.log('✅ Conectado a MongoDB\n');
    return true;
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error.message);
    return false;
  }
}

/**
 * Importa modelos de forma segura
 */
function loadModels() {
  try {
    // Los modelos se crean automáticamente desde @librechat/data-schemas
    const { createModels } = require('@librechat/data-schemas');
    createModels(mongoose);
    
    return {
      AviRol: mongoose.models.AviRol,
      AviSubrol: mongoose.models.AviSubrol,
      User: mongoose.models.User,
    };
  } catch (error) {
    console.error('❌ Error cargando modelos:', error.message);
    throw error;
  }
}

/**
 * Migración de roles (lógica simplificada)
 */
async function migrateRoles(config, models) {
  const { AviRol, AviSubrol, User } = models;
  
  console.log('📊 ANÁLISIS DE CAMBIOS:');
  console.log('═'.repeat(60));
  
  // Obtener roles actuales de BD
  const currentRoles = await AviRol.find({});
  const configRoleNames = config.aviRoles.roles.map(r => r.name);
  
  const rolesToCreate = [];
  const rolesToUpdate = [];
  const rolesToDelete = [];
  
  // Detectar cambios
  for (const configRole of config.aviRoles.roles) {
    const existingRole = currentRoles.find(r => r.name === configRole.name);
    
    if (!existingRole) {
      rolesToCreate.push(configRole);
    } else {
      // Verificar si cambió knowledge o behavior
      const knowledgeChanged = (existingRole.knowledge || null) !== (configRole.knowledge || null);
      const behaviorChanged = (existingRole.behavior || null) !== (configRole.behavior || null);
      
      if (knowledgeChanged || behaviorChanged) {
        rolesToUpdate.push({
          name: configRole.name,
          id: existingRole._id,
          changes: { knowledge: configRole.knowledge, behavior: configRole.behavior }
        });
      }
    }
  }
  
  // Roles a eliminar
  for (const currentRole of currentRoles) {
    if (!configRoleNames.includes(currentRole.name)) {
      rolesToDelete.push(currentRole);
    }
  }
  
  // Mostrar resumen
  if (rolesToCreate.length > 0) {
    console.log(`\n➕ ROLES NUEVOS (${rolesToCreate.length}):`);
    rolesToCreate.forEach(r => console.log(`   • ${r.name}`));
  }
  
  if (rolesToUpdate.length > 0) {
    console.log(`\n🔄 ROLES A ACTUALIZAR (${rolesToUpdate.length}):`);
    rolesToUpdate.forEach(r => {
      console.log(`   • ${r.name}`);
      if (r.changes.knowledge !== undefined) {
        console.log(`     - knowledge: ${r.changes.knowledge ? 'Actualizado' : 'null'}`);
      }
      if (r.changes.behavior !== undefined) {
        console.log(`     - behavior: ${r.changes.behavior ? 'Actualizado' : 'null'}`);
      }
    });
  }
  
  if (rolesToDelete.length > 0) {
    console.log(`\n🗑️  ROLES A ELIMINAR:`);
    rolesToDelete.forEach(r => {
      const userCount = 0; // Simplificado, podrías contar usuarios
      console.log(`   • ${r.name} (${userCount} usuarios)`);
    });
  }
  
  if (rolesToCreate.length === 0 && rolesToUpdate.length === 0 && rolesToDelete.length === 0) {
    console.log('\n✅ No hay cambios en roles');
    return true;
  }
  
  // Confirmación interactiva
  if (INTERACTIVE) {
    console.log('\n' + '═'.repeat(60));
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question('¿Desea continuar con la migración? (y/n): ', resolve);
    });
    readline.close();
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Migración cancelada por el usuario');
      return false;
    }
  }
  
  console.log('\n🔧 APLICANDO CAMBIOS...\n');
  
  // Crear roles nuevos
  for (const roleData of rolesToCreate) {
    await AviRol.create({
      name: roleData.name,
      knowledge: roleData.knowledge || null,
      behavior: roleData.behavior || null,
    });
    console.log(`   ✅ Creado: ${roleData.name}`);
  }
  
  // Actualizar roles existentes
  for (const roleUpdate of rolesToUpdate) {
    await AviRol.findByIdAndUpdate(roleUpdate.id, roleUpdate.changes);
    console.log(`   ✅ Actualizado: ${roleUpdate.name}`);
  }
  
  // Eliminar roles (simplificado)
  for (const role of rolesToDelete) {
    // Verificar usuarios antes de eliminar
    const userCount = await User.countDocuments({ aviRol_id: role._id });
    if (userCount > 0) {
      console.log(`   ⚠️  No se puede eliminar "${role.name}": tiene ${userCount} usuarios asignados`);
    } else {
      await AviRol.findByIdAndDelete(role._id);
      console.log(`   ✅ Eliminado: ${role.name}`);
    }
  }
  
  // Migrar subroles (similar lógica, simplificado aquí)
  await migrateSubroles(config, models);
  
  return true;
}

/**
 * Migración de subroles
 */
async function migrateSubroles(config, models) {
  const { AviRol, AviSubrol } = models;
  
  console.log('\n🔧 Migrando subroles...');
  
  for (const configRole of config.aviRoles.roles) {
    const dbRole = await AviRol.findOne({ name: configRole.name });
    if (!dbRole) continue;
    
    const currentSubroles = await AviSubrol.find({ parentRolId: dbRole._id });
    const configSubroleNames = configRole.subroles || [];
    
    // Crear subroles faltantes
    for (const subroleName of configSubroleNames) {
      const exists = currentSubroles.find(s => s.name === subroleName);
      if (!exists) {
        await AviSubrol.create({
          name: subroleName,
          parentRolId: dbRole._id,
          knowledge: null,
          behavior: null,
        });
        console.log(`   ✅ Subrol creado: "${subroleName}" (padre: ${configRole.name})`);
      }
    }
    
    // Eliminar subroles que ya no están en config
    for (const currentSubrol of currentSubroles) {
      if (!configSubroleNames.includes(currentSubrol.name)) {
        await AviSubrol.findByIdAndDelete(currentSubrol._id);
        console.log(`   🗑️  Subrol eliminado: "${currentSubrol.name}"`);
      }
    }
  }
}

/**
 * Main
 */
async function main() {
  try {
    // Leer configuración
    const config = readLibreChatConfig();
    if (!config || !config.aviRoles) {
      console.error('❌ No se encontró configuración aviRoles en librechat.yaml');
      process.exit(1);
    }
    
    // Conectar a MongoDB
    const connected = await connectToMongoDB();
    if (!connected) {
      process.exit(1);
    }
    
    // Cargar modelos
    const models = loadModels();
    
    // Ejecutar migración
    const success = await migrateRoles(config, models);
    
    if (success) {
      console.log('\n✅ Configuración actualizada exitosamente');
      console.log(`✅ Recarga completada - ${new Date().toISOString()}\n`);
    }
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
