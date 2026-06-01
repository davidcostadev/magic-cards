import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListResponse } from '../../common/interceptors/list.interceptor';
import { toListResponse } from '../../common/pagination';
import type { AuthUser } from '../../common/types/authenticated-request';
import { DashboardService } from './dashboard.service';
import {
  type DashboardStats,
  DashboardStatsDto,
  type Upcoming,
  UpcomingDto,
  type WeakCard,
  WeakCardListDto,
  WeakCardsQueryDto,
} from './dto/dashboard.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('stats')
  @ApiOkResponse({ type: DashboardStatsDto })
  stats(@CurrentUser() user: AuthUser): Promise<DashboardStats> {
    return this.dashboard.getStats(user.id);
  }

  @Get('weak_cards')
  @ApiOkResponse({ type: WeakCardListDto })
  async weakCards(
    @CurrentUser() user: AuthUser,
    @Query() query: WeakCardsQueryDto
  ): Promise<ListResponse<WeakCard>> {
    const rows = await this.dashboard.getWeakCards(user.id, query.limit);
    return toListResponse(rows, query.limit);
  }

  @Get('upcoming')
  @ApiOkResponse({ type: UpcomingDto })
  upcoming(@CurrentUser() user: AuthUser): Promise<Upcoming> {
    return this.dashboard.getUpcoming(user.id);
  }
}
