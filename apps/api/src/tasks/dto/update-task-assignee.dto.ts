import { IsUUID, ValidateIf } from 'class-validator';

export class UpdateTaskAssigneeDto {
  @ValidateIf((_, value: unknown) => value !== null)
  @IsUUID()
  assigneeId!: string | null;
}
