import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CollaborationController } from './collaboration.controller';
import { CollaborationService } from './collaboration.service';

@Module({
  controllers: [CollaborationController],
  imports: [AuthModule],
  providers: [CollaborationService],
})
export class CollaborationModule {}
