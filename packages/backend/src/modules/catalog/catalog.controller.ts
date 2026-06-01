import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { type CardResponse, CardResponseDto, CreateCardDto } from '../cards/dto/card.dto';
import {
  CreateSubjectDto,
  type SubjectResponse,
  SubjectResponseDto,
} from '../subjects/dto/subject.dto';
import { CatalogService } from './catalog.service';

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
}
