import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AUTH_COOKIE_NAME } from './auth.constants';
import type { AuthenticatedRequest } from './auth.types';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (token === undefined) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: unknown;
        tokenVersion?: unknown;
      }>(token);

      if (
        typeof payload.sub !== 'string' ||
        typeof payload.tokenVersion !== 'number'
      ) {
        throw new UnauthorizedException('Invalid authentication token');
      }

      request.user = await this.authService.resolveSession({
        sub: payload.sub,
        tokenVersion: payload.tokenVersion,
      });

      return true;
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const cookieToken = (
      request.cookies as Record<string, unknown> | undefined
    )?.[AUTH_COOKIE_NAME];

    if (typeof cookieToken === 'string' && cookieToken !== '') {
      return cookieToken;
    }

    const authorization = request.headers.authorization;

    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice('Bearer '.length).trim() || undefined;
    }

    return undefined;
  }
}
