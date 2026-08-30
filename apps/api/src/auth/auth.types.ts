import type { AuthUser } from '@tarzan/types';
import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  tokenVersion: number;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}
