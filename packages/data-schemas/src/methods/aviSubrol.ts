// Factory function that takes mongoose instance and returns the methods
export function createAviSubrolMethods(mongoose: typeof import('mongoose')) {
  /**
   * Initialize default AVI subroles in the system.
   * Creates the 9 subroles grouped by their parent roles
   */
  async function initializeAviSubroles() {
    const AviRol = mongoose.models.AviRol;
    const AviSubrol = mongoose.models.AviSubrol;

    // First ensure parent roles exist
    const genericoRole = await AviRol.findOne({ name: 'generico' });
    const cuidadorRole = await AviRol.findOne({ name: 'cuidador' });
    const administrativoRole = await AviRol.findOne({ name: 'administrativo' });

    if (!genericoRole || !cuidadorRole || !administrativoRole) {
      throw new Error('Parent AVI roles must be initialized before creating subroles');
    }

    const defaultSubroles = [
      // Subroles for "generico"
      { name: 'Lector', parentRolId: genericoRole._id },
      { name: 'Comentarista', parentRolId: genericoRole._id },
      { name: 'Colaborador', parentRolId: genericoRole._id },
      // Subroles for "cuidador"
      { name: 'Cuidador Principal', parentRolId: cuidadorRole._id },
      { name: 'Cuidador Secundario', parentRolId: cuidadorRole._id },
      { name: 'Asistente', parentRolId: cuidadorRole._id },
      // Subroles for "administrativo"
      { name: 'Gestor de Usuarios', parentRolId: administrativoRole._id },
      { name: 'Configuración', parentRolId: administrativoRole._id },
      { name: 'Supervisor', parentRolId: administrativoRole._id },
    ];

    for (const subrolData of defaultSubroles) {
      const existingSubrol = await AviSubrol.findOne({
        name: subrolData.name,
        parentRolId: subrolData.parentRolId,
      });
      
      if (!existingSubrol) {
        const newSubrol = new AviSubrol(subrolData);
        await newSubrol.save();
        console.log(`Created AVI subrol: ${subrolData.name} for parent role: ${subrolData.parentRolId}`);
      }
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
  async function createAviSubrol(data: { name: string; parentRolId: string }) {
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
  async function updateAviSubrol(id: string, updates: { name?: string; parentRolId?: string }) {
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