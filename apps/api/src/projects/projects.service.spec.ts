import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TeamRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';

const adminId = 'd53da168-40e6-40c8-85c1-47cc261ef4b8';
const memberId = 'f3a2f768-8399-4dd8-96ca-784b445f097d';
const teamId = '3cb79f02-b617-4f61-ac60-a56ee4998b53';
const projectId = '78027a0c-c1ef-4633-900c-f797e3376673';
const createdAt = new Date('2026-08-30T09:30:00.000Z');

function projectFor(role: TeamRole = TeamRole.ADMIN) {
  return {
    createdAt,
    createdBy: { id: adminId, name: 'Balaji Ravi' },
    createdById: adminId,
    description: 'Customer-facing project',
    id: projectId,
    name: 'Customer portal',
    team: { members: [{ role }], name: 'Platform' },
    teamId,
    updatedAt: createdAt,
  };
}

describe('ProjectsService', () => {
  const projectCreate = vi.fn();
  const projectFindFirst = vi.fn();
  const projectFindMany = vi.fn();
  const projectUpdate = vi.fn();
  const memberFindUnique = vi.fn();
  const prisma = {
    project: {
      create: projectCreate,
      findFirst: projectFindFirst,
      findMany: projectFindMany,
      update: projectUpdate,
    },
    teamMember: { findUnique: memberFindUnique },
  } as unknown as PrismaService;
  let service: ProjectsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectsService(prisma);
  });

  it('lets a team admin create a project', async () => {
    memberFindUnique.mockResolvedValue({ role: TeamRole.ADMIN });
    projectCreate.mockResolvedValue({ id: projectId });
    projectFindFirst.mockResolvedValue(projectFor());

    const result = await service.create(adminId, {
      description: 'Customer-facing project',
      name: 'Customer portal',
      teamId,
    });

    expect(projectCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdById: adminId, teamId }),
      }),
    );
    expect(result.project).toEqual(
      expect.objectContaining({ id: projectId, teamRole: 'ADMIN' }),
    );
  });

  it('lists only projects visible to the current user', async () => {
    projectFindMany.mockResolvedValue([projectFor(TeamRole.MEMBER)]);

    const result = await service.list(memberId, teamId);

    expect(projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          team: { members: { some: { userId: memberId } } },
          teamId,
        },
      }),
    );
    expect(result.projects[0]).toEqual(
      expect.objectContaining({ id: projectId, teamRole: 'MEMBER' }),
    );
  });

  it('does not expose project details to non-members', async () => {
    projectFindFirst.mockResolvedValue(null);

    await expect(service.getById(memberId, projectId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('prevents a regular member from creating a project', async () => {
    memberFindUnique.mockResolvedValue({ role: TeamRole.MEMBER });

    await expect(
      service.create(memberId, { name: 'Member project', teamId }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(projectCreate).not.toHaveBeenCalled();
  });

  it('lets members view a project but not edit it', async () => {
    projectFindFirst
      .mockResolvedValueOnce(projectFor(TeamRole.MEMBER))
      .mockResolvedValueOnce({
        team: { members: [{ role: TeamRole.MEMBER }] },
      });

    const result = await service.getById(memberId, projectId);
    expect(result.project.teamRole).toBe('MEMBER');

    await expect(
      service.update(memberId, projectId, { name: 'Blocked update' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(projectUpdate).not.toHaveBeenCalled();
  });

  it('lets a team admin update project details', async () => {
    projectFindFirst
      .mockResolvedValueOnce({
        team: { members: [{ role: TeamRole.ADMIN }] },
      })
      .mockResolvedValueOnce({
        ...projectFor(),
        description: null,
        name: 'Portal relaunch',
      });
    projectUpdate.mockResolvedValue({ id: projectId });

    const result = await service.update(adminId, projectId, {
      description: '',
      name: 'Portal relaunch',
    });

    expect(projectUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { description: null, name: 'Portal relaunch' },
      }),
    );
    expect(result.project).toEqual(
      expect.objectContaining({ description: null, name: 'Portal relaunch' }),
    );
  });
});
