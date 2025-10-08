import { Schema } from 'mongoose';
import type { IAviRol } from '~/types';

const aviRolSchema: Schema<IAviRol> = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
aviRolSchema.index({ name: 1 });

export default aviRolSchema;