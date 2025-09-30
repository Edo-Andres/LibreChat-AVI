import type { Document, Types } from 'mongoose';
import { CursorPaginationParams } from '~/common';

export interface IAviSubrol extends Document {
  _id: Types.ObjectId;
  name: string;
  parentRolId: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateAviSubrolRequest {
  name: string;
  parentRolId: string | Types.ObjectId;
}

export interface UpdateAviSubrolRequest {
  name?: string;
  parentRolId?: string | Types.ObjectId;
}

export interface AviSubrolFilterOptions extends CursorPaginationParams {
  _id?: Types.ObjectId | string;
  name?: string;
  parentRolId?: Types.ObjectId | string;
  search?: string;
}

export interface AviSubrolQueryOptions {
  fieldsToSelect?: string | string[] | null;
  lean?: boolean;
}