import type {
  AuthUser,
  TeamListResponse,
  TeamMemberResponse,
  TeamResponse,
} from '@tarzan/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTeamDto,
  ): Promise<TeamResponse> {
    return this.teamsService.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<TeamListResponse> {
    return this.teamsService.list(user.id);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) teamId: string,
  ): Promise<TeamResponse> {
    return this.teamsService.getById(user.id, teamId);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) teamId: string,
    @Body() dto: AddTeamMemberDto,
  ): Promise<TeamMemberResponse> {
    return this.teamsService.addMember(user.id, teamId, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ): Promise<void> {
    return this.teamsService.removeMember(user.id, teamId, targetUserId);
  }
}
