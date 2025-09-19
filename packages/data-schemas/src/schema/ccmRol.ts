import { Schema, Document } from 'mongoose';

export interface ICcmRol extends Document {
  nombre: string;
  descripcion?: string;
}

const CcmRol = new Schema<ICcmRol>(
  {
    nombre: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    descripcion: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export default CcmRol;