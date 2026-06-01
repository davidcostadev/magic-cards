import { Module } from '@nestjs/common';
import { GradingService } from './grading.service';
import { LearningService } from './learning.service';
import { Sm2Service } from './sm2.service';

/** Provides the shared spaced-repetition logic used by subjects, cards, and reviews. */
@Module({
  providers: [Sm2Service, GradingService, LearningService],
  exports: [Sm2Service, GradingService, LearningService],
})
export class LearningModule {}
