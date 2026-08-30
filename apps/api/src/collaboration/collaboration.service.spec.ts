import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service';
import { CollaborationService } from './collaboration.service';

const userId = 'f3a2f768-8399-4dd8-96ca-784b445f097d';
const taskId = 'e24d5e29-1bfb-4436-8633-28ea9727b329';
const commentId = 'ef9eb80d-8dd1-4f0f-b4eb-bcbfd2f9f204';
const activityId = 'c22168c8-4ea1-4c3b-be20-94e5524aeb0f';
const createdAt = new Date('2026-08-30T11:30:00.000Z');

const comment = {
  content: 'The endpoint is ready for review.',
  createdAt,
  id: commentId,
  updatedAt: createdAt,
  user: { id: userId, name: 'Team Member' },
};

const activity = {
  action: 'STATUS_CHANGED',
  createdAt,
  id: activityId,
  metadata: { from: 'IN_PROGRESS', to: 'IN_REVIEW' },
  user: { id: userId, name: 'Team Member' },
};

describe('CollaborationService', () => {
  const taskFindFirst = vi.fn();
  const commentCreate = vi.fn();
  const prisma = {
    comment: { create: commentCreate },
    task: { findFirst: taskFindFirst },
  } as unknown as PrismaService;
  let service: CollaborationService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new CollaborationService(prisma);
  });

  it('lets a team member add a comment with author details', async () => {
    taskFindFirst.mockResolvedValue({ id: taskId });
    commentCreate.mockResolvedValue(comment);

    const result = await service.createComment(userId, taskId, {
      content: comment.content,
    });

    expect(commentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { content: comment.content, taskId, userId },
      }),
    );
    expect(result.comment).toEqual(
      expect.objectContaining({ author: comment.user, id: commentId }),
    );
  });

  it('returns task comments in chronological order', async () => {
    taskFindFirst.mockResolvedValue({ comments: [comment] });

    const result = await service.listComments(userId, taskId);

    expect(taskFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          comments: expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
        }),
      }),
    );
    expect(result.comments[0]?.content).toBe(comment.content);
  });

  it('returns important activity newest first', async () => {
    taskFindFirst.mockResolvedValue({ activities: [activity] });

    const result = await service.listActivity(userId, taskId);

    expect(taskFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          activities: expect.objectContaining({
            orderBy: { createdAt: 'desc' },
          }),
        }),
      }),
    );
    expect(result.activities[0]).toEqual(
      expect.objectContaining({
        action: 'STATUS_CHANGED',
        metadata: activity.metadata,
      }),
    );
  });

  it('hides comments and activity from non-members', async () => {
    taskFindFirst.mockResolvedValue(null);

    await expect(service.listComments(userId, taskId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.listActivity(userId, taskId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.createComment(userId, taskId, { content: 'Blocked' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(commentCreate).not.toHaveBeenCalled();
  });
});
