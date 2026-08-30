import type {
  TeamListResponse,
  TeamMemberDetails,
  TeamMemberResponse,
  TeamResponse,
  TeamRole as SharedTeamRole,
  TeamSummary,
} from '@tarzan/types';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TeamRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { AddTeamMemberDto } from './dto/add-team-member.dto';
import type { CreateTeamDto } from './dto/create-team.dto';

const memberUserSelect = {
  email: true,
  id: true,
  name: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTeamDto): Promise<TeamResponse> {
    const team = await this.prisma.team.create({
      data: {
        createdById: userId,
        members: {
          create: {
            role: TeamRole.ADMIN,
            userId,
          },
        },
        name: dto.name,
      },
      select: { id: true },
    });

    return this.getById(userId, team.id);
  }

  async list(userId: string): Promise<TeamListResponse> {
    const memberships = await this.prisma.teamMember.findMany({
      include: {
        team: {
          include: { _count: { select: { members: true } } },
        },
      },
      orderBy: { joinedAt: 'desc' },
      where: { userId },
    });

    return {
      teams: memberships.map((membership) =>
        this.toTeamSummary(
          membership.team,
          membership.role,
          membership.team._count.members,
        ),
      ),
    };
  }

  async getById(userId: string, teamId: string): Promise<TeamResponse> {
    const membership = await this.prisma.teamMember.findUnique({
      include: {
        team: {
          include: {
            _count: { select: { members: true } },
            createdBy: { select: { id: true, name: true } },
            members: {
              include: { user: { select: memberUserSelect } },
              orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
            },
          },
        },
      },
      where: { teamId_userId: { teamId, userId } },
    });

    if (membership === null) {
      throw new NotFoundException('Team not found');
    }

    return {
      team: {
        ...this.toTeamSummary(
          membership.team,
          membership.role,
          membership.team._count.members,
        ),
        createdBy: membership.team.createdBy,
        members: membership.team.members.map((member) =>
          this.toTeamMember(member),
        ),
      },
    };
  }

  async addMember(
    actorUserId: string,
    teamId: string,
    dto: AddTeamMemberDto,
  ): Promise<TeamMemberResponse> {
    await this.requireAdmin(actorUserId, teamId);

    const user = await this.prisma.user.findUnique({
      select: memberUserSelect,
      where: { email: dto.email },
    });

    if (user === null) {
      throw new NotFoundException('No registered user has this email');
    }

    const existingMembership = await this.prisma.teamMember.findUnique({
      select: { userId: true },
      where: { teamId_userId: { teamId, userId: user.id } },
    });

    if (existingMembership !== null) {
      throw new ConflictException('This user is already a team member');
    }

    try {
      const member = await this.prisma.teamMember.create({
        data: {
          role: dto.role ?? TeamRole.MEMBER,
          teamId,
          userId: user.id,
        },
        include: { user: { select: memberUserSelect } },
      });

      return { member: this.toTeamMember(member) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('This user is already a team member');
      }

      throw error;
    }
  }

  async removeMember(
    actorUserId: string,
    teamId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.requireAdmin(actorUserId, teamId);

    const targetMembership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });

    if (targetMembership === null) {
      throw new NotFoundException('Team member not found');
    }

    if (targetMembership.role === TeamRole.ADMIN) {
      const adminCount = await this.prisma.teamMember.count({
        where: { role: TeamRole.ADMIN, teamId },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('A team must always have an admin');
      }
    }

    await this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
  }

  private async requireAdmin(userId: string, teamId: string): Promise<void> {
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

  private toTeamSummary(
    team: {
      createdAt: Date;
      id: string;
      name: string;
      updatedAt: Date;
    },
    role: TeamRole,
    memberCount: number,
  ): TeamSummary {
    return {
      createdAt: team.createdAt.toISOString(),
      id: team.id,
      memberCount,
      name: team.name,
      role: role as SharedTeamRole,
      updatedAt: team.updatedAt.toISOString(),
    };
  }

  private toTeamMember(member: {
    joinedAt: Date;
    role: TeamRole;
    user: { email: string; id: string; name: string };
    userId: string;
  }): TeamMemberDetails {
    return {
      email: member.user.email,
      joinedAt: member.joinedAt.toISOString(),
      name: member.user.name,
      role: member.role as SharedTeamRole,
      userId: member.userId,
    };
  }
}
