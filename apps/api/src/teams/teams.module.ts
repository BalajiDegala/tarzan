import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  controllers: [TeamsController],
  imports: [AuthModule],
  providers: [TeamsService],
})
export class TeamsModule {}
