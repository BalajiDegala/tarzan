import type {
  ActivityListResponse,
  AuthUser,
  CommentListResponse,
  CommentResponse,
} from '@tarzan/types';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CollaborationService } from './collaboration.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class CollaborationController {
  constructor(private readonly collaborationService: CollaborationService) {}

  @Post(':id/comments')
  createComment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponse> {
    return this.collaborationService.createComment(user.id, taskId, dto);
  }

  @Get(':id/comments')
  listComments(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) taskId: string,
  ): Promise<CommentListResponse> {
    return this.collaborationService.listComments(user.id, taskId);
  }

  @Get(':id/activity')
  listActivity(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) taskId: string,
  ): Promise<ActivityListResponse> {
    return this.collaborationService.listActivity(user.id, taskId);
  }
}
