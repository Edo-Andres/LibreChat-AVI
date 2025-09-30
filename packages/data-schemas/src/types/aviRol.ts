import type { Document, Types } from 'mongoose';
import { CursorPaginationParams } from '~/common';

export interface IAviRol extends Document {
  _id: Types.ObjectId;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateAviRolRequest {
  name: string;
}

export interface UpdateAviRolRequest {
  name?: string;
}

export interface AviRolFilterOptions extends CursorPaginationParams {
  _id?: Types.ObjectId | string;
  name?: string;
  search?: string;
}

export interface AviRolQueryOptions {
  fieldsToSelect?: string | string[] | null;
  lean?: boolean;
}