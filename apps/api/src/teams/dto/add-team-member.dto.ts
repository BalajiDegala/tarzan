import type { TeamRole } from '@tarzan/types';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, MaxLength } from 'class-validator';

export class AddTeamMemberDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsIn(['ADMIN', 'MEMBER'])
  role?: TeamRole;
}
