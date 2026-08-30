import type {
  TaskDetails,
  TaskListResponse,
  TaskPriority as SharedTaskPriority,
  TaskResponse,
  TaskStatus as SharedTaskStatus,
  TaskSummary,
  TaskType as SharedTaskType,
  TeamRole as SharedTeamRole,
} from '@tarzan/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskPriority, TaskStatus, TaskType, TeamRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { UpdateTaskAssigneeDto } from './dto/update-task-assignee.dto';
import type { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';

interface VisibleTask {
  assignee: { id: string; name: string } | null;
  assigneeId: string | null;
  createdAt: Date;
  description: string | null;
  dueDate: Date | null;
  id: string;
  labels: string[];
  priority: TaskPriority;
  project: {
    name: string;
    team: { id: string; members: { role: TeamRole }[] };
  };
  projectId: string;
  reporter: { id: string; name: string };
  reporterId: string;
  status: TaskStatus;
  taskKey: string;
  title: string;
  type: TaskType;
  updatedAt: Date;
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskDto): Promise<TaskResponse> {
    const access = await this.getProjectAccess(userId, dto.projectId);

    if (dto.assigneeId !== undefined) {
      if (access.role !== TeamRole.ADMIN) {
        throw new ForbiddenException(
          'Team admin access is required to assign tasks',
        );
      }
      await this.requireAssignableMember(access.teamId, dto.assigneeId);
    }

    const task = await this.prisma.$transaction(async (transaction) => {
      const createdTask = await transaction.task.create({
        data: {
          assigneeId: dto.assigneeId,
          description: this.normalizeOptionalText(dto.description),
          dueDate: this.parseDueDate(dto.dueDate),
          labels: this.normalizeLabels(dto.labels),
          priority: dto.priority ?? TaskPriority.MEDIUM,
          projectId: dto.projectId,
          reporterId: userId,
          status: TaskStatus.BACKLOG,
          title: dto.title,
          type: dto.type ?? TaskType.TASK,
        },
        select: { id: true },
      });

      await transaction.activity.create({
        data: {
          action: 'TASK_CREATED',
          metadata: { title: dto.title },
          taskId: createdTask.id,
          userId,
        },
      });

      return createdTask;
    });

    return this.getById(userId, task.id);
  }

  async list(userId: string, projectId?: string): Promise<TaskListResponse> {
    const tasks = await this.prisma.task.findMany({
      include: this.visibleTaskInclude(userId),
      orderBy: { updatedAt: 'desc' },
      where: {
        ...(projectId === undefined ? {} : { projectId }),
        project: { team: { members: { some: { userId } } } },
      },
    });

    return { tasks: tasks.map((task) => this.toTaskSummary(task)) };
  }

  async getById(userId: string, taskId: string): Promise<TaskResponse> {
    const task = await this.findVisibleTask(userId, taskId);
    return { task: this.toTaskDetails(task) };
  }

  async update(
    userId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskResponse> {
    if (
      dto.title === undefined &&
      dto.description === undefined &&
      dto.type === undefined &&
      dto.priority === undefined &&
      dto.dueDate === undefined &&
      dto.labels === undefined
    ) {
      throw new BadRequestException(
        'Provide at least one task field to update',
      );
    }

    const task = await this.findVisibleTask(userId, taskId);
    this.requireTaskEditor(userId, task);

    const fields = (
      ['title', 'description', 'type', 'priority', 'dueDate', 'labels'] as const
    ).filter((field) => dto[field] !== undefined);

    await this.prisma.$transaction([
      this.prisma.task.update({
        data: {
          ...(dto.description === undefined
            ? {}
            : { description: this.normalizeOptionalText(dto.description) }),
          ...(dto.dueDate === undefined
            ? {}
            : { dueDate: this.parseDueDate(dto.dueDate) }),
          ...(dto.labels === undefined
            ? {}
            : { labels: this.normalizeLabels(dto.labels) }),
          ...(dto.priority === undefined ? {} : { priority: dto.priority }),
          ...(dto.title === undefined ? {} : { title: dto.title }),
          ...(dto.type === undefined ? {} : { type: dto.type }),
        },
        where: { id: taskId },
      }),
      this.prisma.activity.create({
        data: {
          action: 'TASK_UPDATED',
          metadata: { fields },
          taskId,
          userId,
        },
      }),
    ]);

    return this.getById(userId, taskId);
  }

  async remove(userId: string, taskId: string): Promise<void> {
    const task = await this.findVisibleTask(userId, taskId);
    this.requireTeamAdmin(task);
    await this.prisma.task.delete({ where: { id: taskId } });
  }

  async updateStatus(
    userId: string,
    taskId: string,
    dto: UpdateTaskStatusDto,
  ): Promise<TaskResponse> {
    const task = await this.findVisibleTask(userId, taskId);
    this.requireTaskEditor(userId, task);

    if (task.status === dto.status) {
      return { task: this.toTaskDetails(task) };
    }

    await this.prisma.$transaction([
      this.prisma.task.update({
        data: { status: dto.status },
        where: { id: taskId },
      }),
      this.prisma.activity.create({
        data: {
          action: 'STATUS_CHANGED',
          metadata: { from: task.status, to: dto.status },
          taskId,
          userId,
        },
      }),
    ]);

    return this.getById(userId, taskId);
  }

  async updateAssignee(
    userId: string,
    taskId: string,
    dto: UpdateTaskAssigneeDto,
  ): Promise<TaskResponse> {
    const task = await this.findVisibleTask(userId, taskId);
    this.requireTeamAdmin(task);

    const nextAssignee =
      dto.assigneeId === null
        ? null
        : await this.requireAssignableMember(
            task.project.team.id,
            dto.assigneeId,
          );

    if (task.assigneeId === dto.assigneeId) {
      return { task: this.toTaskDetails(task) };
    }

    await this.prisma.$transaction([
      this.prisma.task.update({
        data: { assigneeId: dto.assigneeId },
        where: { id: taskId },
      }),
      this.prisma.activity.create({
        data: {
          action: 'ASSIGNEE_CHANGED',
          metadata: { from: task.assignee, to: nextAssignee },
          taskId,
          userId,
        },
      }),
    ]);

    return this.getById(userId, taskId);
  }

  private async getProjectAccess(
    userId: string,
    projectId: string,
  ): Promise<{ role: TeamRole; teamId: string }> {
    const project = await this.prisma.project.findFirst({
      select: {
        team: {
          select: {
            id: true,
            members: {
              select: { role: true },
              where: { userId },
            },
          },
        },
      },
      where: {
        id: projectId,
        team: { members: { some: { userId } } },
      },
    });
    const membership = project?.team.members[0];

    if (project === null || membership === undefined) {
      throw new NotFoundException('Project not found');
    }

    return { role: membership.role, teamId: project.team.id };
  }

  private async findVisibleTask(
    userId: string,
    taskId: string,
  ): Promise<VisibleTask> {
    const task = await this.prisma.task.findFirst({
      include: this.visibleTaskInclude(userId),
      where: {
        id: taskId,
        project: { team: { members: { some: { userId } } } },
      },
    });

    if (task === null) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  private visibleTaskInclude(userId: string) {
    return {
      assignee: { select: { id: true, name: true } },
      project: {
        select: {
          name: true,
          team: {
            select: {
              id: true,
              members: {
                select: { role: true },
                where: { userId },
              },
            },
          },
        },
      },
      reporter: { select: { id: true, name: true } },
    } as const;
  }

  private requireTaskEditor(userId: string, task: VisibleTask): void {
    const role = this.taskRole(task);
    const isParticipant =
      task.reporterId === userId || task.assigneeId === userId;

    if (role !== TeamRole.ADMIN && !isParticipant) {
      throw new ForbiddenException(
        'Only team admins, the reporter, or the assignee can update this task',
      );
    }
  }

  private requireTeamAdmin(task: VisibleTask): void {
    if (this.taskRole(task) !== TeamRole.ADMIN) {
      throw new ForbiddenException('Team admin access is required');
    }
  }

  private taskRole(task: VisibleTask): TeamRole {
    const membership = task.project.team.members[0];
    if (membership === undefined) {
      throw new NotFoundException('Task not found');
    }
    return membership.role;
  }

  private async requireAssignableMember(
    teamId: string,
    assigneeId: string,
  ): Promise<{ id: string; name: string }> {
    const membership = await this.prisma.teamMember.findUnique({
      select: { user: { select: { id: true, name: true } } },
      where: { teamId_userId: { teamId, userId: assigneeId } },
    });

    if (membership === null) {
      throw new BadRequestException(
        'Assignee must be a member of the project team',
      );
    }

    return membership.user;
  }

  private normalizeOptionalText(value?: string): string | null {
    return value === undefined || value.length === 0 ? null : value;
  }

  private normalizeLabels(labels?: string[]): string[] {
    return [...new Set(labels ?? [])];
  }

  private parseDueDate(value?: string | null): Date | null {
    return value === undefined || value === null
      ? null
      : new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private toTaskSummary(task: VisibleTask): TaskSummary {
    return {
      assignee: task.assignee,
      createdAt: task.createdAt.toISOString(),
      dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null,
      id: task.id,
      priority: task.priority as SharedTaskPriority,
      projectId: task.projectId,
      projectName: task.project.name,
      reporter: task.reporter,
      status: task.status as SharedTaskStatus,
      taskKey: task.taskKey,
      teamRole: this.taskRole(task) as SharedTeamRole,
      title: task.title,
      type: task.type as SharedTaskType,
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private toTaskDetails(task: VisibleTask): TaskDetails {
    return {
      ...this.toTaskSummary(task),
      description: task.description,
      labels: task.labels,
      reporter: task.reporter,
    };
  }
}
