import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TeamRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from './teams.service';

const actorId = 'd53da168-40e6-40c8-85c1-47cc261ef4b8';
const memberId = 'f3a2f768-8399-4dd8-96ca-784b445f097d';
const teamId = '3cb79f02-b617-4f61-ac60-a56ee4998b53';
const createdAt = new Date('2026-08-30T08:20:00.000Z');

const teamMembership = {
  role: TeamRole.ADMIN,
  team: {
    _count: { members: 1 },
    createdAt,
    createdBy: { id: actorId, name: 'Balaji Ravi' },
    id: teamId,
    members: [
      {
        joinedAt: createdAt,
        role: TeamRole.ADMIN,
        user: {
          email: 'balaji@example.com',
          id: actorId,
          name: 'Balaji Ravi',
        },
        userId: actorId,
      },
    ],
    name: 'Platform',
    updatedAt: createdAt,
  },
};

describe('TeamsService', () => {
  const teamCreate = vi.fn();
  const memberCount = vi.fn();
  const memberCreate = vi.fn();
  const memberDelete = vi.fn();
  const memberFindMany = vi.fn();
  const memberFindUnique = vi.fn();
  const userFindUnique = vi.fn();
  const prisma = {
    team: { create: teamCreate },
    teamMember: {
      count: memberCount,
      create: memberCreate,
      delete: memberDelete,
      findMany: memberFindMany,
      findUnique: memberFindUnique,
    },
    user: { findUnique: userFindUnique },
  } as unknown as PrismaService;
  let service: TeamsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TeamsService(prisma);
  });

  it('makes the creator the first team admin', async () => {
    teamCreate.mockResolvedValue({ id: teamId });
    memberFindUnique.mockResolvedValue(teamMembership);

    const result = await service.create(actorId, { name: 'Platform' });

    expect(teamCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: actorId,
          members: { create: { role: TeamRole.ADMIN, userId: actorId } },
          name: 'Platform',
        }),
      }),
    );
    expect(result.team.role).toBe('ADMIN');
    expect(result.team.members).toHaveLength(1);
  });

  it('lists only teams the current user belongs to', async () => {
    memberFindMany.mockResolvedValue([
      {
        joinedAt: createdAt,
        role: TeamRole.ADMIN,
        team: {
          _count: { members: 1 },
          createdAt,
          id: teamId,
          name: 'Platform',
          updatedAt: createdAt,
        },
      },
    ]);

    const result = await service.list(actorId);

    expect(memberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: actorId } }),
    );
    expect(result.teams[0]).toEqual(
      expect.objectContaining({ id: teamId, memberCount: 1, role: 'ADMIN' }),
    );
  });

  it('does not expose a team to non-members', async () => {
    memberFindUnique.mockResolvedValue(null);

    await expect(service.getById(memberId, teamId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('prevents regular members from adding people', async () => {
    memberFindUnique.mockResolvedValue({ role: TeamRole.MEMBER });

    await expect(
      service.addMember(actorId, teamId, {
        email: 'member@example.com',
        role: 'MEMBER',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it('adds an existing registered user', async () => {
    memberFindUnique
      .mockResolvedValueOnce({ role: TeamRole.ADMIN })
      .mockResolvedValueOnce(null);
    userFindUnique.mockResolvedValue({
      email: 'member@example.com',
      id: memberId,
      name: 'Member User',
    });
    memberCreate.mockResolvedValue({
      joinedAt: createdAt,
      role: TeamRole.MEMBER,
      user: {
        email: 'member@example.com',
        id: memberId,
        name: 'Member User',
      },
      userId: memberId,
    });

    const result = await service.addMember(actorId, teamId, {
      email: 'member@example.com',
      role: 'MEMBER',
    });

    expect(result.member).toEqual(
      expect.objectContaining({ role: 'MEMBER', userId: memberId }),
    );
  });

  it('never removes the final team admin', async () => {
    memberFindUnique
      .mockResolvedValueOnce({ role: TeamRole.ADMIN })
      .mockResolvedValueOnce({ role: TeamRole.ADMIN });
    memberCount.mockResolvedValue(1);

    await expect(
      service.removeMember(actorId, teamId, actorId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(memberDelete).not.toHaveBeenCalled();
  });
});
