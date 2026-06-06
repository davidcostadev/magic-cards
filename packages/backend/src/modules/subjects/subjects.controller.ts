import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListResponse } from '../../common/interceptors/list.interceptor';
import { PaginationQueryDto, toListResponse } from '../../common/pagination';
import type { AuthUser } from '../../common/types/authenticated-request';
import {
  CreateSubjectDto,
  SubjectListDto,
  type SubjectProgress,
  SubjectProgressListDto,
  type SubjectResponse,
  SubjectResponseDto,
  type SubjectStats,
  SubjectStatsDto,
  UpdateSubjectDto,
} from './dto/subject.dto';
import { SubjectsService } from './subjects.service';

@ApiTags('subjects')
@ApiBearerAuth()
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get()
  @ApiOkResponse({ type: SubjectListDto })
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto
  ): Promise<ListResponse<SubjectResponse>> {
    const { rows, limit } = await this.subjects.list(user.id, query);
    return toListResponse(rows, limit);
  }

  @Post()
  @HttpCode(201)
  @ApiOkResponse({ type: SubjectResponseDto })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateSubjectDto): Promise<SubjectResponse> {
    return this.subjects.create(user.id, body);
  }

  // Declared before `:id` so the static path isn't captured as a subject id.
  @Get('progress')
  @ApiOkResponse({ type: SubjectProgressListDto })
  async progress(@CurrentUser() user: AuthUser): Promise<{ data: SubjectProgress[] }> {
    return { data: await this.subjects.progressBySubject(user.id) };
  }

  @Get(':id')
  @ApiOkResponse({ type: SubjectResponseDto })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<SubjectResponse> {
    return this.subjects.get(user.id, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: SubjectResponseDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateSubjectDto
  ): Promise<SubjectResponse> {
    return this.subjects.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.subjects.remove(user.id, id);
  }

  @Get(':id/stats')
  @ApiOkResponse({ type: SubjectStatsDto })
  stats(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<SubjectStats> {
    return this.subjects.stats(user.id, id);
  }

  // Add the subject to the user's list ("My Subjects"). Idempotent.
  @Post(':id/selection')
  @HttpCode(204)
  @ApiNoContentResponse()
  async select(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.subjects.selectSubject(user.id, id);
  }

  // Remove the subject from the user's list. Idempotent.
  @Delete(':id/selection')
  @HttpCode(204)
  @ApiNoContentResponse()
  async unselect(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.subjects.unselectSubject(user.id, id);
  }
}
