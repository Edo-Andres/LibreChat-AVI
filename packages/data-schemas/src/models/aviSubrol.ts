import aviSubrolSchema from '~/schema/aviSubrol';
import type { IAviSubrol } from '~/types';

/**
 * Creates or returns the AviSubrol model using the provided mongoose instance and schema
 */
export function createAviSubrolModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.AviSubrol || mongoose.model<IAviSubrol>('AviSubrol', aviSubrolSchema);
}