export interface ServiceHealth {
  name: string;
  status: 'ok';
  version: string;
}

export type UserRole = 'ADMIN' | 'MEMBER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
}
