import { Body, Controller, Get, HttpCode, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/authenticated-request';
import { CardResponseDto } from '../cards/dto/card.dto';
import { LearningService } from '../learning/learning.service';
import {
  type CardProgressResponse,
  CardProgressResponseDto,
  CreateReviewDto,
  ReviewQueueQueryDto,
  type ReviewQueueResponse,
  ReviewQueueResponseDto,
} from './dto/review.dto';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller()
export class ReviewsController {
  constructor(private readonly learning: LearningService) {}

  @Get('review_queue')
  @ApiOkResponse({ type: ReviewQueueResponseDto })
  queue(@CurrentUser() user: AuthUser, @Query() query: ReviewQueueQueryDto): ReviewQueueResponse {
    const { due, new: newCards } = this.learning.getSessionCards(user.id, query.subject);
    return { due, new: newCards, total: due.length + newCards.length };
  }

  @Get('review_queue/next')
  @ApiOkResponse({ type: CardResponseDto })
  next(
    @CurrentUser() user: AuthUser,
    @Query() query: ReviewQueueQueryDto,
    @Res() reply: FastifyReply
  ): void {
    const card = this.learning.getNextCard(user.id, query.subject);
    // 204 when the queue is empty, otherwise the next card to study.
    if (!card) {
      reply.status(204).send();
      return;
    }
    reply.status(200).send(card);
  }

  @Post('reviews')
  @HttpCode(201)
  @ApiOkResponse({ type: CardProgressResponseDto })
  submit(@CurrentUser() user: AuthUser, @Body() body: CreateReviewDto): CardProgressResponse {
    return this.learning.submitReview(
      user.id,
      body.cardId,
      body.quality,
      body.timeSpent,
      body.wasHintUsed
    );
  }
}
