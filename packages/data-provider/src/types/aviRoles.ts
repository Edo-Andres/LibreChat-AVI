// Types for AVI Roles system
export type TAviRol = {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type TAviSubrol = {
  _id: string;
  name: string;
  parentRolId: string;
  createdAt: string;
  updatedAt: string;
};

export type TAviRolesResponse = TAviRol[];
export type TAviSubrolesResponse = TAviSubrol[];