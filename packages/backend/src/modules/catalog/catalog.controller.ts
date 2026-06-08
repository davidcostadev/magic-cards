import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ListResponse } from '../../common/interceptors/list.interceptor';
import { toListResponse } from '../../common/pagination';
import {
  type CardResponse,
  CardResponseDto,
  CreateCardDto,
  UpdateCardDto,
} from '../cards/dto/card.dto';
import {
  CreateSubjectDto,
  type SubjectResponse,
  SubjectResponseDto,
} from '../subjects/dto/subject.dto';
import { CatalogService } from './catalog.service';
import {
  type CatalogCardDetail,
  CatalogCardDetailDto,
  CatalogCardListDto,
  CatalogCardQueryDto,
  type CatalogCardResponse,
  type CatalogReport,
  CatalogReportDto,
  ResolveReportDto,
} from './dto/catalog-cards.dto';
import {
  type CatalogExport,
  CatalogExportDto,
  CatalogExportQueryDto,
  CatalogImportDto,
  type ImportResult,
  ImportResultDto,
} from './dto/catalog-io.dto';

@ApiTags('catalog')
@ApiSecurity('x-api-key')
// Public to the JWT guard; the API key guard authorizes instead.
@Public()
@UseGuards(ApiKeyGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post('subjects')
  @HttpCode(201)
  @ApiOkResponse({ type: SubjectResponseDto })
  createSubject(@Body() body: CreateSubjectDto): Promise<SubjectResponse> {
    return this.catalog.createSubject(body);
  }

  @Post('cards')
  @HttpCode(201)
  @ApiOkResponse({ type: CardResponseDto })
  createCard(@Body() body: CreateCardDto): Promise<CardResponse> {
    return this.catalog.createCard(body);
  }

  @Get('cards')
  @ApiOkResponse({ type: CatalogCardListDto })
  async listCards(@Query() query: CatalogCardQueryDto): Promise<ListResponse<CatalogCardResponse>> {
    const { rows, limit } = await this.catalog.listCards(query);
    return toListResponse(rows, limit);
  }

  @Get('cards/:id')
  @ApiOkResponse({ type: CatalogCardDetailDto })
  getCard(@Param('id') id: string): Promise<CatalogCardDetail> {
    return this.catalog.getCardDetail(id);
  }

  @Patch('cards/:id')
  @ApiOkResponse({ type: CatalogCardDetailDto })
  updateCard(@Param('id') id: string, @Body() body: UpdateCardDto): Promise<CatalogCardDetail> {
    return this.catalog.updateCard(id, body);
  }

  @Patch('card_reports/:id')
  @ApiOkResponse({ type: CatalogReportDto })
  resolveReport(@Param('id') id: string, @Body() body: ResolveReportDto): Promise<CatalogReport> {
    return this.catalog.resolveReport(id, body);
  }

  @Post('import')
  @HttpCode(200)
  @ApiOkResponse({ type: ImportResultDto })
  importContent(@Body() body: CatalogImportDto): Promise<ImportResult> {
    return this.catalog.import(body);
  }

  @Get('export')
  @ApiOkResponse({ type: CatalogExportDto })
  exportContent(@Query() query: CatalogExportQueryDto): Promise<CatalogExport> {
    return this.catalog.export(query.subject);
  }

  @Delete('subjects/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  deleteSubject(@Param('id') id: string): Promise<void> {
    return this.catalog.deleteSubject(id);
  }
}
