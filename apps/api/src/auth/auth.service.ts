import type { AuthSession, AuthUser } from '@tarzan/types';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { compare, hash } from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import type { AuthResult, JwtPayload } from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

const PASSWORD_HASH_ROUNDS = 12;
const DUMMY_PASSWORD_HASH =
  '$2b$12$hWXU2reOkWPeR9yvuKNDXeQEtWWNJXEXSsJSOm29vFGVJWOM0c/9.';

const sessionUserSelect = {
  createdAt: true,
  email: true,
  id: true,
  name: true,
  role: true,
  tokenVersion: true,
} satisfies Prisma.UserSelect;

type SessionUser = Prisma.UserGetPayload<{ select: typeof sessionUserSelect }>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      select: { id: true },
      where: { email },
    });

    if (existingUser !== null) {
      throw new ConflictException('An account with this email already exists');
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          name: dto.name.trim(),
          passwordHash: await hash(dto.password, PASSWORD_HASH_ROUNDS),
        },
        select: sessionUserSelect,
      });

      return this.createAuthResult(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const passwordMatches = await compare(
      dto.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (user === null || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createAuthResult(user);
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      data: { tokenVersion: { increment: 1 } },
      where: { id: userId },
    });
  }

  async resolveSession(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      select: sessionUserSelect,
      where: { id: payload.sub },
    });

    if (user === null || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    return this.toAuthUser(user);
  }

  toSession(user: AuthUser): AuthSession {
    return { user };
  }

  private async createAuthResult(user: SessionUser): Promise<AuthResult> {
    return {
      token: await this.jwtService.signAsync({
        sub: user.id,
        tokenVersion: user.tokenVersion,
      } satisfies JwtPayload),
      user: this.toAuthUser(user),
    };
  }

  private toAuthUser(user: SessionUser): AuthUser {
    return {
      createdAt: user.createdAt.toISOString(),
      email: user.email,
      id: user.id,
      name: user.name,
      role: user.role,
    };
  }
}
