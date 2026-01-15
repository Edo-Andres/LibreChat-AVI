// Types for AVI Roles system
export type TAviRol = {
  _id: string;
  name: string;
  knowledge?: string | null;
  behavior?: string | null;
  initial_suggestions?: string[];
  registerAnswer?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TAviSubrol = {
  _id: string;
  name: string;
  parentRolId: string;
  knowledge?: string | null;
  behavior?: string | null;
  initial_suggestions?: string[];
  registerAnswer?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TAviRolesResponse = TAviRol[];
export type TAviSubrolesResponse = TAviSubrol[];