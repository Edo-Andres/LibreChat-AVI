const path = require('path');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const CcmRol = require('~/models/CcmRol');
const User = require('~/models/User');
const connect = require('./connect');

(async () => {
  await connect();
  console.log('Conectado a la BD.');

  // Definir los 3 roles de CcmRol
  const rolesData = [
    { nombre: 'generico', descripcion: 'Rol genérico por defecto' },
    { nombre: 'psicologo', descripcion: 'Rol para psicólogos' },
    { nombre: 'cuidador', descripcion: 'Rol para cuidadores' }
  ];

  console.log('Creando/actualizando roles de CcmRol...');
  
  // Crear o actualizar cada rol
  const createdRoles = [];
  for (const roleData of rolesData) {
    const role = await CcmRol.findOneAndUpdate(
      { nombre: roleData.nombre },
      roleData,
      { upsert: true, new: true }
    );
    console.log(`✅ Rol '${role.nombre}' ID: ${role._id}`);
    createdRoles.push(role);
  }

  // Obtener el rol 'generico' para asignarlo por defecto
  const genericRol = createdRoles.find(r => r.nombre === 'generico');
  
  // Actualizar usuarios sin ccmRol asignándoles 'generico'
  const result = await User.updateMany(
    { ccmRol: { $exists: false } },
    { ccmRol: genericRol._id }
  );
  console.log(`👥 Usuarios actualizados con rol 'generico': ${result.modifiedCount}`);

  console.log('✅ Migración completada exitosamente.');
  console.log('📊 Resumen:');
  console.log(`   - Roles creados: ${createdRoles.length}`);
  console.log(`   - Usuarios migrados: ${result.modifiedCount}`);
  
  process.exit(0);
})();