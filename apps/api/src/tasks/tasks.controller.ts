import type { AuthUser, TaskListResponse, TaskResponse } from '@tarzan/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { UpdateTaskAssigneeDto } from './dto/update-task-assignee.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskResponse> {
    return this.tasksService.create(user.id, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTasksQueryDto,
  ): Promise<TaskListResponse> {
    return this.tasksService.list(user.id, query);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) taskId: string,
  ): Promise<TaskResponse> {
    return this.tasksService.getById(user.id, taskId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskResponse> {
    return this.tasksService.update(user.id, taskId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) taskId: string,
  ): Promise<void> {
    return this.tasksService.remove(user.id, taskId);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskStatusDto,
  ): Promise<TaskResponse> {
    return this.tasksService.updateStatus(user.id, taskId, dto);
  }

  @Patch(':id/assignee')
  updateAssignee(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskAssigneeDto,
  ): Promise<TaskResponse> {
    return this.tasksService.updateAssignee(user.id, taskId, dto);
  }
}
