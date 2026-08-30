import type {
  ProjectListResponse,
  ProjectResponse,
  ProjectSummary,
  TeamRole as SharedTeamRole,
} from '@tarzan/types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TeamRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateProjectDto,
  ): Promise<ProjectResponse> {
    await this.requireTeamAdmin(userId, dto.teamId);

    const project = await this.prisma.project.create({
      data: {
        createdById: userId,
        description: this.normalizeDescription(dto.description),
        name: dto.name,
        teamId: dto.teamId,
      },
      select: { id: true },
    });

    return this.getById(userId, project.id);
  }

  async list(userId: string, teamId?: string): Promise<ProjectListResponse> {
    const projects = await this.prisma.project.findMany({
      include: {
        team: {
          select: {
            members: {
              select: { role: true },
              where: { userId },
            },
            name: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      where: {
        ...(teamId === undefined ? {} : { teamId }),
        team: { members: { some: { userId } } },
      },
    });

    return {
      projects: projects.map((project) => this.toProjectSummary(project)),
    };
  }

  async getById(userId: string, projectId: string): Promise<ProjectResponse> {
    const project = await this.prisma.project.findFirst({
      include: {
        createdBy: { select: { id: true, name: true } },
        team: {
          select: {
            members: {
              select: { role: true },
              where: { userId },
            },
            name: true,
          },
        },
      },
      where: {
        id: projectId,
        team: { members: { some: { userId } } },
      },
    });

    if (project === null) {
      throw new NotFoundException('Project not found');
    }

    return {
      project: {
        ...this.toProjectSummary(project),
        createdBy: project.createdBy,
      },
    };
  }

  async update(
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectResponse> {
    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException('Provide a name or description to update');
    }

    const project = await this.prisma.project.findFirst({
      select: {
        team: {
          select: {
            members: {
              select: { role: true },
              where: { userId },
            },
          },
        },
      },
      where: { id: projectId },
    });

    const membership = project?.team.members[0];
    if (membership === undefined) {
      throw new NotFoundException('Project not found');
    }

    if (membership.role !== TeamRole.ADMIN) {
      throw new ForbiddenException('Team admin access is required');
    }

    await this.prisma.project.update({
      data: {
        ...(dto.description === undefined
          ? {}
          : { description: this.normalizeDescription(dto.description) }),
        ...(dto.name === undefined ? {} : { name: dto.name }),
      },
      where: { id: projectId },
    });

    return this.getById(userId, projectId);
  }

  private async requireTeamAdmin(
    userId: string,
    teamId: string,
  ): Promise<void> {
    const membership = await this.prisma.teamMember.findUnique({
      select: { role: true },
      where: { teamId_userId: { teamId, userId } },
    });

    if (membership === null) {
      throw new NotFoundException('Team not found');
    }

    if (membership.role !== TeamRole.ADMIN) {
      throw new ForbiddenException('Team admin access is required');
    }
  }

  private normalizeDescription(description?: string): string | null {
    return description === undefined || description.length === 0
      ? null
      : description;
  }

  private toProjectSummary(project: {
    createdAt: Date;
    description: string | null;
    id: string;
    name: string;
    team: { members: { role: TeamRole }[]; name: string };
    teamId: string;
    updatedAt: Date;
  }): ProjectSummary {
    const membership = project.team.members[0];
    if (membership === undefined) {
      throw new NotFoundException('Project not found');
    }

    return {
      createdAt: project.createdAt.toISOString(),
      description: project.description,
      id: project.id,
      name: project.name,
      teamId: project.teamId,
      teamName: project.team.name,
      teamRole: membership.role as SharedTeamRole,
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}
