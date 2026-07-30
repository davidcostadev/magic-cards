import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

// LearningModule provides Sm2Service — the timeline replays the same scheduling maths.
@Module({
  imports: [LearningModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
