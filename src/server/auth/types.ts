export type AuthUser = {
  id: string;
  displayName: string;
  email: string | null;
  isChildAccount: boolean;
};

export type AuthSession = {
  user: AuthUser;
  issuedAt: string;
};

export type RegisterInput = {
  displayName: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type ChildLoginInput = {
  familyCode: string;
  username: string;
  pin: string;
};
