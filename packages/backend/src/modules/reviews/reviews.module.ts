import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { ReviewsController } from './reviews.controller';

@Module({
  imports: [LearningModule],
  controllers: [ReviewsController],
})
export class ReviewsModule {}
