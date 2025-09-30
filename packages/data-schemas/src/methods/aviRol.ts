// Factory function that takes mongoose instance and returns the methods
export function createAviRolMethods(mongoose: typeof import('mongoose')) {
  /**
   * Initialize default AVI roles in the system.
   * Creates the 3 main roles: generico, cuidador, administrativo
   */
  async function initializeAviRoles() {
    const AviRol = mongoose.models.AviRol;
    
    const defaultRoles = ['generico', 'cuidador', 'administrativo'];
    
    for (const roleName of defaultRoles) {
      const existingRole = await AviRol.findOne({ name: roleName });
      if (!existingRole) {
        const newRole = new AviRol({ name: roleName });
        await newRole.save();
        console.log(`Created AVI role: ${roleName}`);
      }
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
  async function createAviRol(data: { name: string }) {
    const AviRol = mongoose.models.AviRol;
    const newRole = new AviRol(data);
    return await newRole.save();
  }

  /**
   * Update an AVI role
   */
  async function updateAviRol(id: string, updates: { name?: string }) {
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