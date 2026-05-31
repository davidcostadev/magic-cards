import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListResponse } from '../../common/interceptors/list.interceptor';
import { PaginationQueryDto, toListResponse } from '../../common/pagination';
import type { AuthUser } from '../../common/types/authenticated-request';
import {
  CreateSubjectDto,
  SubjectListDto,
  type SubjectResponse,
  SubjectResponseDto,
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
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto
  ): ListResponse<SubjectResponse> {
    const { rows, limit } = this.subjects.list(user.id, query);
    return toListResponse(rows, limit);
  }

  @Post()
  @HttpCode(201)
  @ApiOkResponse({ type: SubjectResponseDto })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateSubjectDto): SubjectResponse {
    return this.subjects.create(user.id, body);
  }

  @Get(':id')
  @ApiOkResponse({ type: SubjectResponseDto })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): SubjectResponse {
    return this.subjects.get(user.id, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: SubjectResponseDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateSubjectDto
  ): SubjectResponse {
    return this.subjects.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): void {
    this.subjects.remove(user.id, id);
  }

  @Get(':id/stats')
  @ApiOkResponse({ type: SubjectStatsDto })
  stats(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.subjects.stats(user.id, id);
  }
}
