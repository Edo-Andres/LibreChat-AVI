/**
 * AVI Roles Dynamic Configuration System
 * 
 * Este módulo gestiona la configuración dinámica de roles y subroles AVI.
 * Lee desde librechat.yaml (vía getAppConfig) con fallback a variable de entorno
 * y configuración por defecto.
 * 
 * Implementa:
 * - Lectura de configuración desde múltiples fuentes
 * - Validación de estructura y conflictos
 * - Migración automática de roles/subroles
 * - Gestión de integridad referencial
 */

const mongoose = require('mongoose');
const { getAppConfig } = require('../api/server/services/Config/app');
const { logger } = require('@librechat/data-schemas');

// Configuración por defecto (fallback)
const DEFAULT_CONFIG = {
  roles: [
    {
      name: 'generico',
      subroles: ['Lector', 'Comentarista', 'Colaborador'],
    },
    {
      name: 'cuidador',
      subroles: ['Cuidador Principal', 'Cuidador Secundario', 'Asistente'],
    },
    {
      name: 'administrativo',
      subroles: ['Gestor de Usuarios', 'Configuración', 'Supervisor'],
    },
  ],
  migrations: {
    roles: {},
    subroles: {},
    defaultRoleForOrphans: 'generico',
  },
};

/**
 * Lee la configuración de AVI Roles desde las fuentes disponibles
 * Prioridad: librechat.yaml > AVI_ROLES_CONFIG > DEFAULT_CONFIG
 */
async function getAviRolesFromConfig() {
  try {
    // Intento 1: Leer desde librechat.yaml via getAppConfig
    const appConfig = await getAppConfig({ refresh: true });
    
    if (appConfig && appConfig.config && appConfig.config.aviRoles) {
      console.log('[DEBUG] appConfig.config.aviRoles existe');
      console.log('[DEBUG] appConfig.config.aviRoles:', JSON.stringify(appConfig.config.aviRoles, null, 2));
      logger.info('[AVI Roles] Configuración cargada desde librechat.yaml');
      logger.info('[AVI Roles] appConfig.aviRoles existe, intentando validar...');
      logger.debug('[AVI Roles] Config raw:', JSON.stringify(appConfig.config.aviRoles, null, 2));
      
      try {
        logger.info('[AVI Roles] Llamando a validateAndNormalizeConfig...');
        const validated = validateAndNormalizeConfig(appConfig.config.aviRoles);
        logger.info('[AVI Roles] Configuración validada correctamente');
        return validated;
      } catch (validationError) {
        logger.error('[AVI Roles] Error validando configuración:', validationError.message);
        logger.error('[AVI Roles] Stack de validación:', validationError.stack);
        throw validationError;
      }
    } else {
      console.log('[DEBUG] appConfig no existe o no tiene config.aviRoles');
      console.log('[DEBUG] appConfig.config:', appConfig?.config);
    }

    // Intento 2: Variable de entorno AVI_ROLES_CONFIG
    if (process.env.AVI_ROLES_CONFIG) {
      logger.info('[AVI Roles] Intentando cargar desde variable de entorno AVI_ROLES_CONFIG');
      const envConfig = parseEnvConfig(process.env.AVI_ROLES_CONFIG);
      if (envConfig) {
        return validateAndNormalizeConfig(envConfig);
      }
    }

    // Fallback: Configuración por defecto
    logger.warn('[AVI Roles] Usando configuración por defecto (hardcoded)');
    return validateAndNormalizeConfig(DEFAULT_CONFIG);

  } catch (error) {
    logger.error('[AVI Roles] Error al cargar configuración:', error.message);
    logger.error('[AVI Roles] Stack:', error.stack);
    logger.warn('[AVI Roles] Usando configuración por defecto como fallback');
    return validateAndNormalizeConfig(DEFAULT_CONFIG);
  }
}

/**
 * Parsea la configuración desde variable de entorno
 * Soporta JSON directo o Base64
 */
function parseEnvConfig(envValue) {
  try {
    // Intento 1: JSON directo
    try {
      const parsed = JSON.parse(envValue);
      // Si tiene wrapper 'aviRoles', extraerlo
      return parsed.aviRoles || parsed;
    } catch (e) {
      // No es JSON directo, intentar Base64
    }

    // Intento 2: Base64
    const decoded = Buffer.from(envValue, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    return parsed.aviRoles || parsed;

  } catch (error) {
    logger.error('[AVI Roles] Error parseando AVI_ROLES_CONFIG:', error.message);
    return null;
  }
}

/**
 * Valida y normaliza la estructura de configuración
 */
function validateAndNormalizeConfig(config) {
  if (!config || !config.roles || !Array.isArray(config.roles)) {
    throw new Error('Config debe tener un array "roles"');
  }

  if (config.roles.length === 0) {
    throw new Error('Config debe tener al menos 1 rol');
  }

  // Validar que no haya roles con nombres duplicados
  const roleNames = config.roles.map(r => r.name);
  const duplicates = roleNames.filter((name, index) => roleNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Roles duplicados en configuración: ${duplicates.join(', ')}`);
  }

  // Validar estructura de cada rol
  config.roles.forEach(role => {
    if (!role.name || typeof role.name !== 'string') {
      throw new Error('Cada rol debe tener un "name" (string)');
    }
    if (!role.subroles || !Array.isArray(role.subroles)) {
      role.subroles = [];
    }
    // Filtrar subroles vacíos
    role.subroles = role.subroles.filter(s => s && typeof s === 'string' && s.trim() !== '');
  });

  // Normalizar migrations si no existe
  if (!config.migrations) {
    config.migrations = {
      roles: {},
      subroles: {},
      defaultRoleForOrphans: config.roles[0]?.name || 'generico',
    };
  }

  // Validar que no haya conflictos en migrations.roles
  const targetRoles = Object.values(config.migrations.roles || {});
  const conflictingTargets = targetRoles.filter((name, index) => targetRoles.indexOf(name) !== index);
  if (conflictingTargets.length > 0) {
    throw new Error(`Conflicto: múltiples roles mapean al mismo nombre: ${conflictingTargets.join(', ')}`);
  }

  return config;
}

/**
 * Obtiene la lista de roles configurados
 */
async function getConfiguredRoles() {
  const config = await getAviRolesFromConfig();
  return config.roles.map(r => r.name);
}

/**
 * Obtiene los subroles configurados para un rol específico
 */
async function getConfiguredSubroles(roleName) {
  const config = await getAviRolesFromConfig();
  const role = config.roles.find(r => r.name === roleName);
  return role ? role.subroles : [];
}

/**
 * Ejecuta la migración completa de AVI Roles
 * @param {boolean} interactive - Si true, muestra resumen y pide confirmación
 */
async function migrateAviRoles(interactive = false) {
  const startTime = new Date();
  logger.info(`[AVI Roles Migration] Iniciando migración - ${startTime.toISOString()}`);

  let session = null;
  let useTransaction = false;

  try {
    // Cargar configuración
    const config = await getAviRolesFromConfig();
    logger.info('[AVI Roles Migration] Configuración parseada correctamente');

    // Obtener modelos
    const AviRol = mongoose.models.AviRol;
    const AviSubrol = mongoose.models.AviSubrol;
    const User = mongoose.models.User;

    if (!AviRol || !AviSubrol || !User) {
      throw new Error('Modelos no disponibles. Asegúrese de que mongoose esté conectado.');
    }

    // Obtener estado actual de la BD
    const currentRoles = await AviRol.find({}).lean();
    const currentSubroles = await AviSubrol.find({}).lean();
    const userCount = await User.countDocuments({});

    logger.info(`[AVI Roles Migration] Estado actual: ${currentRoles.length} roles, ${currentSubroles.length} subroles, ${userCount} usuarios`);

    // Analizar cambios
    const changes = analyzeChanges(config, currentRoles, currentSubroles);

    // Si es modo interactivo, mostrar resumen y pedir confirmación
    if (interactive) {
      const continuar = await mostrarResumenYConfirmar(changes);
      if (!continuar) {
        logger.info('[AVI Roles Migration] Migración cancelada por el usuario');
        return { success: false, reason: 'Cancelado por usuario' };
      }
    }

    // Verificar si MongoDB soporta transacciones (Replica Set requerido)
    // En modo standalone, las transacciones fallan con "Transaction numbers are only allowed on replica set"
    try {
      const adminDb = mongoose.connection.db.admin();
      const serverStatus = await adminDb.serverStatus();
      const isReplicaSet = serverStatus.repl && serverStatus.repl.setName;
      
      if (isReplicaSet) {
        session = await mongoose.startSession();
        session.startTransaction();
        useTransaction = true;
        logger.info('[AVI Roles Migration] ✅ Usando transacciones MongoDB (Replica Set detectado)');
      } else {
        logger.warn('[AVI Roles Migration] ⚠️  MongoDB standalone detectado. Ejecutando SIN transacciones.');
        logger.warn('[AVI Roles Migration] ℹ️  Para habilitar transacciones, configure MongoDB como Replica Set');
        useTransaction = false;
        session = null;
      }
    } catch (error) {
      logger.warn('[AVI Roles Migration] ⚠️  No se pudo verificar soporte de transacciones, ejecutando sin transacción');
      logger.debug('[AVI Roles Migration] Error al verificar:', error.message);
      useTransaction = false;
      session = null;
    }

    const sessionOpt = useTransaction ? { session } : undefined;

    // PASO 1: Migrar Roles
    logger.info('[AVI Roles Migration] PASO 1: Migrando roles...');
    await migrateRoles(config, currentRoles, sessionOpt);

    // PASO 2: Migrar Subroles
    logger.info('[AVI Roles Migration] PASO 2: Migrando subroles...');
    await migrateSubroles(config, currentRoles, currentSubroles, sessionOpt);

    // PASO 3: Validar integridad referencial
    logger.info('[AVI Roles Migration] PASO 3: Validando integridad referencial...');
    await validateReferentialIntegrity(config, sessionOpt);

    // Commit de la transacción
    if (useTransaction) {
      await session.commitTransaction();
      logger.info('[AVI Roles Migration] Transacción confirmada');
    }

    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    logger.info(`[AVI Roles Migration] ✅ Migración completada exitosamente en ${duration}s`);

    return { success: true, duration, changes };

  } catch (error) {
    // Rollback en caso de error
    if (useTransaction && session) {
      await session.abortTransaction();
      logger.error('[AVI Roles Migration] Transacción revertida debido a error');
    }
    logger.error('[AVI Roles Migration] ❌ Error en migración:', error);
    throw error;

  } finally {
    if (session) {
      session.endSession();
    }
  }
}

/**
 * Analiza los cambios que se realizarán
 */
function analyzeChanges(config, currentRoles, currentSubroles) {
  const changes = {
    rolesToRename: [],
    rolesToCreate: [],
    rolesToDelete: [],
    subrolesToRename: [],
    subrolesToCreate: [],
    subrolesToDelete: [],
    warnings: [],
  };

  const configRoleNames = config.roles.map(r => r.name);
  const currentRoleNames = currentRoles.map(r => r.name);
  const migrations = config.migrations || {};

  // Analizar roles
  for (const [oldName, newName] of Object.entries(migrations.roles || {})) {
    const oldRole = currentRoles.find(r => r.name === oldName);
    if (oldRole) {
      changes.rolesToRename.push({ oldName, newName, id: oldRole._id });
    }
  }

  // Roles nuevos
  for (const roleName of configRoleNames) {
    const isRenamed = Object.values(migrations.roles || {}).includes(roleName);
    const exists = currentRoleNames.includes(roleName);
    if (!exists && !isRenamed) {
      changes.rolesToCreate.push(roleName);
    }
  }

  // Roles a eliminar (sin usuarios)
  for (const role of currentRoles) {
    const inConfig = configRoleNames.includes(role.name);
    const willBeRenamed = migrations.roles && migrations.roles[role.name];
    if (!inConfig && !willBeRenamed) {
      changes.rolesToDelete.push({ name: role.name, id: role._id });
    }
  }

  // Analizar subroles
  for (const [oldName, newName] of Object.entries(migrations.subroles || {})) {
    if (newName === null) {
      changes.subrolesToDelete.push(oldName);
    } else {
      changes.subrolesToRename.push({ oldName, newName });
    }
  }

  return changes;
}

/**
 * Muestra resumen de cambios y pide confirmación (modo interactivo)
 */
async function mostrarResumenYConfirmar(changes) {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('📊 ANÁLISIS DE CAMBIOS:');
  console.log('════════════════════════════════════════════════════════\n');

  if (changes.rolesToRename.length > 0) {
    console.log('🔄 RENOMBRES DE ROLES:');
    changes.rolesToRename.forEach(r => console.log(`   • "${r.oldName}" → "${r.newName}"`));
    console.log('');
  }

  if (changes.rolesToCreate.length > 0) {
    console.log('➕ ROLES NUEVOS:');
    changes.rolesToCreate.forEach(r => console.log(`   • ${r}`));
    console.log('');
  }

  if (changes.rolesToDelete.length > 0) {
    console.log('🗑️  ROLES A ELIMINAR:');
    changes.rolesToDelete.forEach(r => console.log(`   • ${r.name}`));
    console.log('');
  }

  if (changes.subrolesToRename.length > 0) {
    console.log('🔄 RENOMBRES DE SUBROLES:');
    changes.subrolesToRename.forEach(s => console.log(`   • "${s.oldName}" → "${s.newName}"`));
    console.log('');
  }

  if (changes.subrolesToDelete.length > 0) {
    console.log('🗑️  SUBROLES A ELIMINAR:');
    changes.subrolesToDelete.forEach(s => console.log(`   • ${s}`));
    console.log('');
  }

  if (changes.warnings.length > 0) {
    console.log('⚠️  ADVERTENCIAS:');
    changes.warnings.forEach(w => console.log(`   • ${w}`));
    console.log('');
  }

  console.log('════════════════════════════════════════════════════════');
  
  // Pedir confirmación
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('¿Desea continuar con la migración? (y/n): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Migra los roles según la configuración
 */
async function migrateRoles(config, currentRoles, sessionOpt) {
  const AviRol = mongoose.models.AviRol;
  const migrations = config.migrations || {};
  const configRoleNames = config.roles.map(r => r.name);

  // Renombrar roles existentes
  for (const [oldName, newName] of Object.entries(migrations.roles || {})) {
    const role = currentRoles.find(r => r.name === oldName);
    if (role) {
      await AviRol.updateOne(
        { _id: role._id },
        { $set: { name: newName } },
        sessionOpt || {}
      );
      logger.info(`   🔄 Renombrado: "${oldName}" → "${newName}" (ID: ${role._id})`);
    }
  }

  // Crear roles nuevos
  const renamedTargets = Object.values(migrations.roles || {});
  for (const roleConfig of config.roles) {
    const roleName = roleConfig.name;
    const exists = currentRoles.find(r => r.name === roleName);
    const isRenamed = renamedTargets.includes(roleName);
    
    if (!exists && !isRenamed) {
      const newRole = new AviRol({
        name: roleName,
        knowledge: roleConfig.knowledge || null,
        behavior: roleConfig.behavior || null,
      });
      if (sessionOpt && sessionOpt.session) {
        await newRole.save({ session: sessionOpt.session });
      } else {
        await newRole.save();
      }
      logger.info(`   ➕ Creado: "${roleName}" (knowledge: ${roleConfig.knowledge ? 'Yes' : 'No'}, behavior: ${roleConfig.behavior ? 'Yes' : 'No'})`);
    } else if (exists) {
      // Actualizar knowledge y behavior si el rol ya existe
      const updateFields = {};
      if (roleConfig.knowledge !== undefined) {
        updateFields.knowledge = roleConfig.knowledge || null;
      }
      if (roleConfig.behavior !== undefined) {
        updateFields.behavior = roleConfig.behavior || null;
      }
      
      if (Object.keys(updateFields).length > 0) {
        updateFields.updatedAt = new Date();
        await AviRol.updateOne(
          { _id: exists._id },
          { $set: updateFields },
          sessionOpt || {}
        );
        logger.info(`   🔄 Actualizado: "${roleName}" (knowledge: ${roleConfig.knowledge ? 'Yes' : 'No'}, behavior: ${roleConfig.behavior ? 'Yes' : 'No'})`);
      }
    }
  }

  // Eliminar roles sin usuarios
  const User = mongoose.models.User;
  for (const role of currentRoles) {
    const inConfig = configRoleNames.includes(role.name);
    const willBeRenamed = migrations.roles && migrations.roles[role.name];
    
    if (!inConfig && !willBeRenamed) {
      const userCount = await User.countDocuments({ aviRol_id: role._id });
      if (userCount === 0) {
        await AviRol.deleteOne({ _id: role._id }, sessionOpt || {});
        logger.info(`   🗑️  Eliminado: "${role.name}" (0 usuarios)`);
      } else {
        logger.warn(`   ⚠️  Mantenido: "${role.name}" (${userCount} usuarios, no está en config)`);
      }
    }
  }
}

/**
 * Migra los subroles según la configuración
 */
async function migrateSubroles(config, currentRoles, currentSubroles, sessionOpt) {
  const AviSubrol = mongoose.models.AviSubrol;
  const User = mongoose.models.User;
  const migrations = config.migrations || {};

  // Construir mapa de roles actualizados
  const roleMap = {};
  for (const role of config.roles) {
    const dbRole = await mongoose.models.AviRol.findOne({ name: role.name }).lean();
    if (dbRole) {
      roleMap[role.name] = { id: dbRole._id, subroles: role.subroles };
    }
  }

  // Procesar cada rol configurado
  for (const [roleName, roleData] of Object.entries(roleMap)) {
    logger.info(`   📁 Procesando subroles de "${roleName}":`);

    const currentRolSubroles = currentSubroles.filter(
      s => s.parentRolId.toString() === roleData.id.toString()
    );

    // Renombrar subroles según migrations
    for (const [oldName, newName] of Object.entries(migrations.subroles || {})) {
      if (newName === null) continue; // Eliminación se maneja después

      const subrol = currentRolSubroles.find(s => s.name === oldName);
      if (subrol) {
        await AviSubrol.updateOne(
          { _id: subrol._id },
          { $set: { name: newName } },
          sessionOpt || {}
        );
        logger.info(`      🔄 Renombrado: "${oldName}" → "${newName}"`);
      }
    }

    // Crear subroles nuevos
    for (const subrolName of roleData.subroles) {
      const exists = currentRolSubroles.find(s => s.name === subrolName);
      const wasRenamed = Object.values(migrations.subroles || {}).includes(subrolName);
      
      if (!exists && !wasRenamed) {
        const newSubrol = new AviSubrol({
          name: subrolName,
          parentRolId: roleData.id,
          knowledge: null,  // Subroles no tienen knowledge propio (Opción 1)
          behavior: null,   // Subroles no tienen behavior propio (Opción 1)
        });
        if (sessionOpt && sessionOpt.session) {
          await newSubrol.save({ session: sessionOpt.session });
        } else {
          await newSubrol.save();
        }
        logger.info(`      ➕ Creado: "${subrolName}"`);
      }
    }

    // Eliminar subroles no listados en la nueva configuración
    for (const subrol of currentRolSubroles) {
      const inConfig = roleData.subroles.includes(subrol.name);
      const markedForDeletion = migrations.subroles && migrations.subroles[subrol.name] === null;
      const wasRenamed = Object.keys(migrations.subroles || {}).includes(subrol.name);
      
      // NO eliminar si el subrol fue renombrado (ya se procesó en el paso anterior)
      if ((!inConfig || markedForDeletion) && !wasRenamed) {
        const userCount = await User.countDocuments({ aviSubrol_id: subrol._id });
        await AviSubrol.deleteOne({ _id: subrol._id }, sessionOpt || {});
        
        // Actualizar usuarios afectados
        if (userCount > 0) {
          await User.updateMany(
            { aviSubrol_id: subrol._id },
            { $unset: { aviSubrol_id: '' } },
            sessionOpt || {}
          );
          logger.info(`      🗑️  Eliminado: "${subrol.name}" (${userCount} usuarios afectados → aviSubrol_id: null)`);
        } else {
          logger.info(`      🗑️  Eliminado: "${subrol.name}" (0 usuarios)`);
        }
      }
    }
  }
}

/**
 * Valida y corrige la integridad referencial
 */
async function validateReferentialIntegrity(config, sessionOpt) {
  const AviSubrol = mongoose.models.AviSubrol;
  const User = mongoose.models.User;

  // Caso A: Usuarios con aviSubrol_id pero sin aviRol_id
  const usersWithOrphanSubroles = await User.find({
    aviSubrol_id: { $exists: true, $ne: null },
    $or: [
      { aviRol_id: { $exists: false } },
      { aviRol_id: null },
    ],
  });

  for (const user of usersWithOrphanSubroles) {
    const subrol = await AviSubrol.findById(user.aviSubrol_id);
    if (subrol && subrol.parentRolId) {
      await User.updateOne(
        { _id: user._id },
        { $set: { aviRol_id: subrol.parentRolId } },
        sessionOpt || {}
      );
      logger.info(`   ✅ Corregido usuario ${user._id}: asignado aviRol_id desde subrol`);
    }
  }

  // Caso B: Subroles huérfanos (parentRolId no existe)
  const allSubroles = await AviSubrol.find({});
  const AviRol = mongoose.models.AviRol;

  for (const subrol of allSubroles) {
    const parentExists = await AviRol.exists({ _id: subrol.parentRolId });
    if (!parentExists) {
      const userCount = await User.countDocuments({ aviSubrol_id: subrol._id });
      await AviSubrol.deleteOne({ _id: subrol._id }, sessionOpt || {});
      
      if (userCount > 0) {
        await User.updateMany(
          { aviSubrol_id: subrol._id },
          { $unset: { aviSubrol_id: '' } },
          sessionOpt || {}
        );
        logger.info(`   🗑️  Eliminado subrol huérfano "${subrol.name}" (${userCount} usuarios afectados)`);
      } else {
        logger.info(`   🗑️  Eliminado subrol huérfano "${subrol.name}"`);
      }
    }
  }

  logger.info('   ✅ Integridad referencial validada');
}

module.exports = {
  getAviRolesFromConfig,
  getConfiguredRoles,
  getConfiguredSubroles,
  migrateAviRoles,
};
