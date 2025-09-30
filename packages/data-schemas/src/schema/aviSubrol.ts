import { Schema, Types } from 'mongoose';
import type { IAviSubrol } from '~/types';

const aviSubrolSchema: Schema<IAviSubrol> = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    parentRolId: {
      type: Schema.Types.ObjectId,
      ref: 'AviRol',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for unique subrol names within the same parent role
aviSubrolSchema.index({ name: 1, parentRolId: 1 }, { unique: true });

// Index for faster queries by parent role
aviSubrolSchema.index({ parentRolId: 1 });

export default aviSubrolSchema;