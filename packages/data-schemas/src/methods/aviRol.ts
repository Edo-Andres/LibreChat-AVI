// Factory function that takes mongoose instance and returns the methods
export function createAviRolMethods(mongoose: typeof import('mongoose')) {
  /**
   * Initialize AVI roles in the system.
   * Now uses dynamic configuration from librechat.yaml via avi-roles-config
   * 
   * NOTA: Esta función solo se debe ejecutar manualmente o en primera instalación.
   * Para migraciones, usar scripts/reload-avi-roles.sh
   */
  async function initializeAviRoles() {
    const AviRol = mongoose.models.AviRol;
    
    // Verificar si ya existen roles en la BD
    const existingRolesCount = await AviRol.countDocuments({});
    
    if (existingRolesCount > 0) {
      console.log(`[AVI Roles] ${existingRolesCount} roles ya existen. Omitiendo inicialización automática.`);
      console.log('[AVI Roles] Para actualizar roles, use: scripts/reload-avi-roles.sh');
      return;
    }
    
    console.log('[AVI Roles] Base de datos vacía. Inicializando roles por primera vez...');
    
    try {
      // Cargar roles desde configuración dinámica
      const { getConfiguredRoles } = require('../../../../../config/avi-roles-config');
      const configuredRoles = await getConfiguredRoles();
      
      console.log(`[AVI Roles] Inicializando ${configuredRoles.length} roles desde configuración`);
      
      for (const roleName of configuredRoles) {
        const newRole = new AviRol({ name: roleName });
        await newRole.save();
        console.log(`[AVI Roles] Creado rol: ${roleName}`);
      }
    } catch (error) {
      console.error('[AVI Roles] Error al inicializar roles:', error);
      console.error('[AVI Roles] Por favor ejecute manualmente: scripts/reload-avi-roles.sh');
    }
  }

  /**
   * Get all AVI roles
   */
  async function listAviRoles() {
    const AviRol = mongoose.models.AviRol;
    return await AviRol.find({}).sort({ name: 1 }).lean();
  }

  /**
   * Get AVI role by ID
   */
  async function getAviRolById(id: string) {
    const AviRol = mongoose.models.AviRol;
    return await AviRol.findById(id).lean();
  }

  /**
   * Get AVI role by name
   */
  async function getAviRolByName(name: string) {
    const AviRol = mongoose.models.AviRol;
    return await AviRol.findOne({ name }).lean();
  }

  /**
   * Create a new AVI role
   */
  async function createAviRol(data: { name: string; knowledge?: string | null; behavior?: string | null }) {
    const AviRol = mongoose.models.AviRol;
    const newRole = new AviRol(data);
    return await newRole.save();
  }

  /**
   * Update an AVI role
   */
  async function updateAviRol(id: string, updates: { name?: string; knowledge?: string | null; behavior?: string | null }) {
    const AviRol = mongoose.models.AviRol;
    return await AviRol.findByIdAndUpdate(id, updates, { new: true, lean: true });
  }

  /**
   * Delete an AVI role (with validation to prevent deletion if it has subroles)
   */
  async function deleteAviRol(id: string) {
    const AviRol = mongoose.models.AviRol;
    const AviSubrol = mongoose.models.AviSubrol;
    
    // Check if role has subroles
    const hasSubroles = await AviSubrol.countDocuments({ parentRolId: id });
    if (hasSubroles > 0) {
      throw new Error('Cannot delete role that has subroles assigned');
    }
    
    return await AviRol.findByIdAndDelete(id);
  }

  // Return all methods you want to expose
  return {
    initializeAviRoles,
    listAviRoles,
    getAviRolById,
    getAviRolByName,
    createAviRol,
    updateAviRol,
    deleteAviRol,
  };
}

export type AviRolMethods = ReturnType<typeof createAviRolMethods>;