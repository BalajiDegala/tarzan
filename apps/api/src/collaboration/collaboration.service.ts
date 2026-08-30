import type {
  ActivityAction,
  ActivityListResponse,
  CommentListResponse,
  CommentResponse,
  TaskActivity,
  TaskComment,
} from '@tarzan/types';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CollaborationService {
  constructor(private readonly prisma: PrismaService) {}

  async createComment(
    userId: string,
    taskId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponse> {
    await this.requireVisibleTask(userId, taskId);

    const comment = await this.prisma.comment.create({
      data: { content: dto.content, taskId, userId },
      include: { user: { select: { id: true, name: true } } },
    });

    return { comment: this.toComment(comment) };
  }

  async listComments(
    userId: string,
    taskId: string,
  ): Promise<CommentListResponse> {
    const task = await this.prisma.task.findFirst({
      include: {
        comments: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      where: {
        id: taskId,
        project: { team: { members: { some: { userId } } } },
      },
    });

    if (task === null) {
      throw new NotFoundException('Task not found');
    }

    return {
      comments: task.comments.map((comment) => this.toComment(comment)),
    };
  }

  async listActivity(
    userId: string,
    taskId: string,
  ): Promise<ActivityListResponse> {
    const task = await this.prisma.task.findFirst({
      include: {
        activities: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      where: {
        id: taskId,
        project: { team: { members: { some: { userId } } } },
      },
    });

    if (task === null) {
      throw new NotFoundException('Task not found');
    }

    return {
      activities: task.activities.map((activity) => this.toActivity(activity)),
    };
  }

  private async requireVisibleTask(
    userId: string,
    taskId: string,
  ): Promise<void> {
    const task = await this.prisma.task.findFirst({
      select: { id: true },
      where: {
        id: taskId,
        project: { team: { members: { some: { userId } } } },
      },
    });

    if (task === null) {
      throw new NotFoundException('Task not found');
    }
  }

  private toComment(comment: {
    content: string;
    createdAt: Date;
    id: string;
    updatedAt: Date;
    user: { id: string; name: string };
  }): TaskComment {
    return {
      author: comment.user,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      id: comment.id,
      updatedAt: comment.updatedAt.toISOString(),
    };
  }

  private toActivity(activity: {
    action: string;
    createdAt: Date;
    id: string;
    metadata: Prisma.JsonValue;
    user: { id: string; name: string };
  }): TaskActivity {
    const metadata =
      activity.metadata !== null &&
      typeof activity.metadata === 'object' &&
      !Array.isArray(activity.metadata)
        ? (activity.metadata as Record<string, unknown>)
        : {};

    return {
      action: activity.action as ActivityAction,
      actor: activity.user,
      createdAt: activity.createdAt.toISOString(),
      id: activity.id,
      metadata,
    };
  }
}
