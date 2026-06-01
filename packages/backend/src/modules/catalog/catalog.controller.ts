import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { type CardResponse, CardResponseDto, CreateCardDto } from '../cards/dto/card.dto';
import {
  CreateSubjectDto,
  type SubjectResponse,
  SubjectResponseDto,
} from '../subjects/dto/subject.dto';
import { CatalogService } from './catalog.service';
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
