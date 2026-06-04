import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListResponse } from '../../common/interceptors/list.interceptor';
import { toListResponse } from '../../common/pagination';
import type { AuthUser } from '../../common/types/authenticated-request';
import {
  CreateReportDto,
  ReportListDto,
  ReportListQueryDto,
  type ReportResponse,
  ReportResponseDto,
} from './dto/report.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('card_reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @ApiOkResponse({ type: ReportListDto })
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: ReportListQueryDto
  ): Promise<ListResponse<ReportResponse>> {
    const { rows, limit } = await this.reports.list(user.id, query);
    return toListResponse(rows, limit);
  }

  @Post()
  @HttpCode(201)
  @ApiOkResponse({ type: ReportResponseDto })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateReportDto): Promise<ReportResponse> {
    return this.reports.create(user.id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.reports.remove(user.id, id);
  }
}
