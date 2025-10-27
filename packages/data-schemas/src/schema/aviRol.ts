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
    knowledge: {
      type: String,
      required: false,
      default: null,
      maxlength: 10000,
      trim: true,
    },
    behavior: {
      type: String,
      required: false,
      default: null,
      maxlength: 10000,
      trim: true,
    },
    registerAnswer: {
      type: String,
      required: false,
      default: null,
      maxlength: 10000,
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