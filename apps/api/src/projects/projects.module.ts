import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  imports: [AuthModule],
  providers: [ProjectsService],
})
export class ProjectsModule {}
