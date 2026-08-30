import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TaskPriority, TaskStatus, TaskType, TeamRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';

const adminId = 'd53da168-40e6-40c8-85c1-47cc261ef4b8';
const memberId = 'f3a2f768-8399-4dd8-96ca-784b445f097d';
const otherMemberId = 'a362902d-baf8-44ee-a629-52714133535d';
const teamId = '3cb79f02-b617-4f61-ac60-a56ee4998b53';
const projectId = '78027a0c-c1ef-4633-900c-f797e3376673';
const taskId = 'e24d5e29-1bfb-4436-8633-28ea9727b329';
const createdAt = new Date('2026-08-30T10:00:00.000Z');

function visibleTask(
  role: TeamRole = TeamRole.ADMIN,
  overrides: Partial<{
    assigneeId: string | null;
    reporterId: string;
    status: TaskStatus;
    title: string;
  }> = {},
) {
  const assigneeId = overrides.assigneeId ?? null;
  return {
    assignee:
      assigneeId === null ? null : { id: assigneeId, name: 'Team Member' },
    assigneeId,
    createdAt,
    description: 'Implement the endpoint',
    dueDate: new Date('2026-09-10T00:00:00.000Z'),
    id: taskId,
    labels: ['backend', 'api'],
    priority: TaskPriority.HIGH,
    project: {
      name: 'Customer portal',
      team: { id: teamId, members: [{ role }] },
    },
    projectId,
    reporter: {
      id: overrides.reporterId ?? adminId,
      name: 'Task Reporter',
    },
    reporterId: overrides.reporterId ?? adminId,
    status: overrides.status ?? TaskStatus.BACKLOG,
    taskKey: 'TASK-100',
    title: overrides.title ?? 'Implement payment API',
    type: TaskType.TASK,
    updatedAt: createdAt,
  };
}

describe('TasksService', () => {
  const projectFindFirst = vi.fn();
  const taskCreate = vi.fn();
  const taskDelete = vi.fn();
  const taskFindFirst = vi.fn();
  const taskFindMany = vi.fn();
  const taskUpdate = vi.fn();
  const memberFindUnique = vi.fn();
  const prisma = {
    project: { findFirst: projectFindFirst },
    task: {
      create: taskCreate,
      delete: taskDelete,
      findFirst: taskFindFirst,
      findMany: taskFindMany,
      update: taskUpdate,
    },
    teamMember: { findUnique: memberFindUnique },
  } as unknown as PrismaService;
  let service: TasksService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TasksService(prisma);
  });

  it('lets a project member create an unassigned task with a generated key', async () => {
    projectFindFirst.mockResolvedValue({
      team: { id: teamId, members: [{ role: TeamRole.MEMBER }] },
    });
    taskCreate.mockResolvedValue({ id: taskId });
    taskFindFirst.mockResolvedValue(
      visibleTask(TeamRole.MEMBER, { reporterId: memberId }),
    );

    const result = await service.create(memberId, {
      labels: ['backend', 'backend'],
      priority: TaskPriority.HIGH,
      projectId,
      title: 'Implement payment API',
      type: TaskType.TASK,
    });

    expect(taskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          labels: ['backend'],
          projectId,
          reporterId: memberId,
          status: TaskStatus.BACKLOG,
        }),
      }),
    );
    expect(taskCreate.mock.calls[0]?.[0].data).not.toHaveProperty('taskKey');
    expect(result.task.taskKey).toBe('TASK-100');
  });

  it('prevents a regular member from assigning during creation', async () => {
    projectFindFirst.mockResolvedValue({
      team: { id: teamId, members: [{ role: TeamRole.MEMBER }] },
    });

    await expect(
      service.create(memberId, {
        assigneeId: memberId,
        projectId,
        title: 'Assigned task',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(taskCreate).not.toHaveBeenCalled();
  });

  it('lists only tasks in projects visible to the current user', async () => {
    taskFindMany.mockResolvedValue([visibleTask(TeamRole.MEMBER)]);

    const result = await service.list(memberId, projectId);

    expect(taskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          project: { team: { members: { some: { userId: memberId } } } },
          projectId,
        },
      }),
    );
    expect(result.tasks[0]).toEqual(
      expect.objectContaining({ taskKey: 'TASK-100', teamRole: 'MEMBER' }),
    );
  });

  it('does not expose task details to a non-member', async () => {
    taskFindFirst.mockResolvedValue(null);

    await expect(service.getById(memberId, taskId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lets a member update and move a task they reported', async () => {
    taskFindFirst
      .mockResolvedValueOnce(
        visibleTask(TeamRole.MEMBER, { reporterId: memberId }),
      )
      .mockResolvedValueOnce(
        visibleTask(TeamRole.MEMBER, {
          reporterId: memberId,
          title: 'Updated payment API',
        }),
      )
      .mockResolvedValueOnce(
        visibleTask(TeamRole.MEMBER, { reporterId: memberId }),
      )
      .mockResolvedValueOnce(
        visibleTask(TeamRole.MEMBER, {
          reporterId: memberId,
          status: TaskStatus.IN_PROGRESS,
        }),
      );
    taskUpdate.mockResolvedValue({ id: taskId });

    const updated = await service.update(memberId, taskId, {
      title: 'Updated payment API',
    });
    const moved = await service.updateStatus(memberId, taskId, {
      status: TaskStatus.IN_PROGRESS,
    });

    expect(updated.task.title).toBe('Updated payment API');
    expect(moved.task.status).toBe('IN_PROGRESS');
  });

  it('prevents an unrelated regular member from editing a task', async () => {
    taskFindFirst.mockResolvedValue(visibleTask(TeamRole.MEMBER));

    await expect(
      service.update(otherMemberId, taskId, { title: 'Blocked update' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(taskUpdate).not.toHaveBeenCalled();
  });

  it('only assigns users who belong to the project team', async () => {
    taskFindFirst.mockResolvedValue(visibleTask());
    memberFindUnique.mockResolvedValue(null);

    await expect(
      service.updateAssignee(adminId, taskId, { assigneeId: otherMemberId }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(taskUpdate).not.toHaveBeenCalled();
  });

  it('lets an admin assign and delete tasks', async () => {
    taskFindFirst
      .mockResolvedValueOnce(visibleTask())
      .mockResolvedValueOnce(
        visibleTask(TeamRole.ADMIN, { assigneeId: memberId }),
      )
      .mockResolvedValueOnce(visibleTask());
    memberFindUnique.mockResolvedValue({ userId: memberId });
    taskUpdate.mockResolvedValue({ id: taskId });
    taskDelete.mockResolvedValue({ id: taskId });

    const result = await service.updateAssignee(adminId, taskId, {
      assigneeId: memberId,
    });
    await service.remove(adminId, taskId);

    expect(result.task.assignee?.id).toBe(memberId);
    expect(taskDelete).toHaveBeenCalledWith({ where: { id: taskId } });
  });
});
