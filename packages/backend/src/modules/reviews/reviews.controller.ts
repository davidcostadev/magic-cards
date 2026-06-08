import { Body, Controller, Get, HttpCode, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/authenticated-request';
import { CardResponseDto } from '../cards/dto/card.dto';
import { LearningService } from '../learning/learning.service';
import {
  CheckReviewDto,
  CheckReviewResponseDto,
  CreateReviewDto,
  EliminateChoiceDto,
  EliminateChoiceResponseDto,
  type EliminateChoiceResult,
  type GradeResult,
  type ReviewQueueCountsResponse,
  ReviewQueueCountsResponseDto,
  ReviewQueueQueryDto,
  type ReviewQueueResponse,
  ReviewQueueResponseDto,
  SubmitReviewResponseDto,
  type SubmitReviewResult,
} from './dto/review.dto';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller()
export class ReviewsController {
  constructor(private readonly learning: LearningService) {}

  @Get('review_queue')
  @ApiOkResponse({ type: ReviewQueueResponseDto })
  async queue(
    @CurrentUser() user: AuthUser,
    @Query() query: ReviewQueueQueryDto
  ): Promise<ReviewQueueResponse> {
    const { due, new: newCards } = await this.learning.getSessionCards(
      user.id,
      query.subject,
      query.type,
      query.ahead,
      query.mistakes
    );
    return { due, new: newCards, total: due.length + newCards.length };
  }

  @Get('review_queue/counts')
  @ApiOkResponse({ type: ReviewQueueCountsResponseDto })
  counts(
    @CurrentUser() user: AuthUser,
    @Query() query: ReviewQueueQueryDto
  ): Promise<ReviewQueueCountsResponse> {
    return this.learning.getTypeCounts(user.id, query.subject);
  }

  @Get('review_queue/next')
  @ApiOkResponse({ type: CardResponseDto })
  async next(
    @CurrentUser() user: AuthUser,
    @Query() query: ReviewQueueQueryDto,
    @Res() reply: FastifyReply
  ): Promise<void> {
    const card = await this.learning.getNextCard(
      user.id,
      query.subject,
      query.type,
      query.ahead,
      query.mistakes
    );
    // 204 when the queue is empty, otherwise the next card to study.
    if (!card) {
      reply.status(204).send();
      return;
    }
    reply.status(200).send(card);
  }

  @Post('reviews')
  @HttpCode(201)
  @ApiOkResponse({ type: SubmitReviewResponseDto })
  submit(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateReviewDto
  ): Promise<SubmitReviewResult> {
    return this.learning.submitReview(user.id, body);
  }

  // Grade-only: re-grades a re-practised answer in the short loop, without scheduling or recording.
  @Post('reviews/check')
  @HttpCode(200)
  @ApiOkResponse({ type: CheckReviewResponseDto })
  check(@CurrentUser() user: AuthUser, @Body() body: CheckReviewDto): Promise<GradeResult> {
    return this.learning.checkReview(user.id, body);
  }

  // Quiz "eliminate" hint: greys out one wrong choice at a time (correctness stays server-side).
  @Post('quiz_hints')
  @HttpCode(200)
  @ApiOkResponse({ type: EliminateChoiceResponseDto })
  eliminate(
    @CurrentUser() user: AuthUser,
    @Body() body: EliminateChoiceDto
  ): Promise<EliminateChoiceResult> {
    return this.learning.eliminateChoice(user.id, body);
  }
}
