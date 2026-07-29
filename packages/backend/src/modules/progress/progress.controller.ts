import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/authenticated-request';
import {
  ResetProgressDto,
  ResetProgressResponseDto,
  type ResetProgressResult,
} from './dto/progress.dto';
import { ProgressService } from './progress.service';

@ApiTags('progress')
@ApiBearerAuth()
@Controller('card_progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Post('reset')
  @HttpCode(200)
  @ApiOkResponse({ type: ResetProgressResponseDto })
  reset(
    @CurrentUser() user: AuthUser,
    @Body() body: ResetProgressDto
  ): Promise<ResetProgressResult> {
    return this.progress.reset(user.id, body);
  }
}
