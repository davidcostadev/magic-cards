import { Module } from '@nestjs/common';
import { LearningService } from './learning.service';
import { Sm2Service } from './sm2.service';

/** Provides the shared spaced-repetition logic used by subjects, cards, and reviews. */
@Module({
  providers: [Sm2Service, LearningService],
  exports: [Sm2Service, LearningService],
})
export class LearningModule {}
