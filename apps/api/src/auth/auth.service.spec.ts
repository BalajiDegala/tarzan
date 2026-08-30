import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const createdAt = new Date('2026-08-30T07:30:00.000Z');
const sessionUser = {
  createdAt,
  email: 'balaji@example.com',
  id: 'd53da168-40e6-40c8-85c1-47cc261ef4b8',
  name: 'Balaji Ravi',
  role: 'MEMBER' as const,
  tokenVersion: 0,
};

describe('AuthService', () => {
  const findUnique = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const signAsync = vi.fn().mockResolvedValue('signed-token');
  const prisma = {
    user: { create, findUnique, update },
  } as unknown as PrismaService;
  const jwtService = { signAsync } as unknown as JwtService;
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    signAsync.mockResolvedValue('signed-token');
    service = new AuthService(prisma, jwtService);
  });

  it('normalizes registration data and stores only a password hash', async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue(sessionUser);

    const result = await service.register({
      email: '  Balaji@Example.COM ',
      name: '  Balaji Ravi  ',
      password: 'StrongPass1',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'balaji@example.com',
          name: 'Balaji Ravi',
          passwordHash: expect.not.stringContaining('StrongPass1'),
        }),
      }),
    );
    expect(result).toEqual({
      token: 'signed-token',
      user: {
        createdAt: createdAt.toISOString(),
        email: sessionUser.email,
        id: sessionUser.id,
        name: sessionUser.name,
        role: 'MEMBER',
      },
    });
  });

  it('rejects duplicate registrations', async () => {
    findUnique.mockResolvedValue({ id: sessionUser.id });

    await expect(
      service.register({
        email: sessionUser.email,
        name: sessionUser.name,
        password: 'StrongPass1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects invalid login credentials with a generic error', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@example.com', password: 'StrongPass1' }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<UnauthorizedException>>({
        message: 'Invalid email or password',
      }),
    );
  });

  it('creates a token for valid credentials', async () => {
    findUnique.mockResolvedValue({
      ...sessionUser,
      passwordHash: await hash('StrongPass1', 4),
      updatedAt: createdAt,
    });

    const result = await service.login({
      email: 'BALAJI@example.com',
      password: 'StrongPass1',
    });

    expect(result.token).toBe('signed-token');
    expect(signAsync).toHaveBeenCalledWith({
      sub: sessionUser.id,
      tokenVersion: 0,
    });
  });

  it('invalidates all existing tokens on logout', async () => {
    update.mockResolvedValue(undefined);

    await service.logout(sessionUser.id);

    expect(update).toHaveBeenCalledWith({
      data: { tokenVersion: { increment: 1 } },
      where: { id: sessionUser.id },
    });
  });

  it('rejects a token issued before logout', async () => {
    findUnique.mockResolvedValue({ ...sessionUser, tokenVersion: 2 });

    await expect(
      service.resolveSession({ sub: sessionUser.id, tokenVersion: 1 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
