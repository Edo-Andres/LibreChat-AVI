// Factory function that takes mongoose instance and returns the methods
export function createAviSubrolMethods(mongoose: typeof import('mongoose')) {
  /**
   * Initialize AVI subroles in the system.
   * Now uses dynamic configuration from librechat.yaml via avi-roles-config
   * 
   * NOTA: Esta función solo se debe ejecutar manualmente o en primera instalación.
   * Para migraciones, usar scripts/reload-avi-roles.sh
   */
  async function initializeAviSubroles() {
    const AviRol = mongoose.models.AviRol;
    const AviSubrol = mongoose.models.AviSubrol;

    // Verificar si ya existen subroles en la BD
    const existingSubrolesCount = await AviSubrol.countDocuments({});
    
    if (existingSubrolesCount > 0) {
      console.log(`[AVI Subroles] ${existingSubrolesCount} subroles ya existen. Omitiendo inicialización automática.`);
      console.log('[AVI Subroles] Para actualizar subroles, use: scripts/reload-avi-roles.sh');
      return;
    }
    
    console.log('[AVI Subroles] Base de datos vacía. Inicializando subroles por primera vez...');

    try {
      // Cargar configuración dinámica
      const { getAviRolesFromConfig } = require('../../../../../config/avi-roles-config');
      const config = await getAviRolesFromConfig();
      
      console.log(`[AVI Subroles] Inicializando subroles desde configuración`);

      // Procesar cada rol configurado
      for (const roleConfig of config.roles) {
        const parentRole = await AviRol.findOne({ name: roleConfig.name });
        
        if (!parentRole) {
          console.warn(`[AVI Subroles] Rol padre "${roleConfig.name}" no encontrado, omitiendo subroles`);
          continue;
        }

        // Crear subroles para este rol
        for (const subrolName of roleConfig.subroles || []) {
          const newSubrol = new AviSubrol({
            name: subrolName,
            parentRolId: parentRole._id,
          });
          await newSubrol.save();
          console.log(`[AVI Subroles] Creado subrol: ${subrolName} (rol: ${roleConfig.name})`);
        }
      }
    } catch (error) {
      console.error('[AVI Subroles] Error al inicializar subroles:', error);
      console.error('[AVI Subroles] Por favor ejecute manualmente: scripts/reload-avi-roles.sh');
    }
  }

  /**
   * Get all AVI subroles
   */
  async function listAviSubroles() {
    const AviSubrol = mongoose.models.AviSubrol;
    return await AviSubrol.find({})
      .populate('parentRolId', 'name')
      .sort({ parentRolId: 1, name: 1 })
      .lean();
  }

  /**
   * Get AVI subroles by parent role ID
   */
  async function getAviSubrolesByParentId(parentRolId: string) {
    const AviSubrol = mongoose.models.AviSubrol;
    return await AviSubrol.find({ parentRolId })
      .sort({ name: 1 })
      .lean();
  }

  /**
   * Get AVI subrol by ID
   */
  async function getAviSubrolById(id: string) {
    const AviSubrol = mongoose.models.AviSubrol;
    return await AviSubrol.findById(id)
      .populate('parentRolId', 'name')
      .lean();
  }

  /**
   * Validate that a subrol belongs to a specific parent role
   */
  async function validateSubrolBelongsToRole(subrolId: string, expectedParentRolId: string) {
    const AviSubrol = mongoose.models.AviSubrol;
    const subrol = await AviSubrol.findById(subrolId);
    
    if (!subrol) {
      return { isValid: false, error: 'Subrol not found' };
    }
    
    if (subrol.parentRolId.toString() !== expectedParentRolId.toString()) {
      return { 
        isValid: false, 
        error: 'Subrol does not belong to the specified role' 
      };
    }
    
    return { isValid: true };
  }

  /**
   * Create a new AVI subrol
   */
  async function createAviSubrol(data: { name: string; parentRolId: string; knowledge?: string | null; behavior?: string | null }) {
    const AviRol = mongoose.models.AviRol;
    const AviSubrol = mongoose.models.AviSubrol;
    
    // Validate parent role exists
    const parentRole = await AviRol.findById(data.parentRolId);
    if (!parentRole) {
      throw new Error('Parent role not found');
    }
    
    const newSubrol = new AviSubrol(data);
    return await newSubrol.save();
  }

  /**
   * Update an AVI subrol
   */
  async function updateAviSubrol(id: string, updates: { name?: string; parentRolId?: string; knowledge?: string | null; behavior?: string | null }) {
    const AviRol = mongoose.models.AviRol;
    const AviSubrol = mongoose.models.AviSubrol;
    
    // If updating parentRolId, validate it exists
    if (updates.parentRolId) {
      const parentRole = await AviRol.findById(updates.parentRolId);
      if (!parentRole) {
        throw new Error('Parent role not found');
      }
    }
    
    return await AviSubrol.findByIdAndUpdate(id, updates, { new: true, lean: true });
  }

  /**
   * Delete an AVI subrol
   */
  async function deleteAviSubrol(id: string) {
    const AviSubrol = mongoose.models.AviSubrol;
    return await AviSubrol.findByIdAndDelete(id);
  }

  // Return all methods you want to expose
  return {
    initializeAviSubroles,
    listAviSubroles,
    getAviSubrolesByParentId,
    getAviSubrolById,
    validateSubrolBelongsToRole,
    createAviSubrol,
    updateAviSubrol,
    deleteAviSubrol,
  };
}

export type AviSubrolMethods = ReturnType<typeof createAviSubrolMethods>;