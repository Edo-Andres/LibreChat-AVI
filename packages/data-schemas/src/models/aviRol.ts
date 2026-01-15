import aviRolSchema from '~/schema/aviRol';
import type { IAviRol } from '~/types';

/**
 * Creates or returns the AviRol model using the provided mongoose instance and schema
 */
export function createAviRolModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.AviRol || mongoose.model<IAviRol>('AviRol', aviRolSchema);
}