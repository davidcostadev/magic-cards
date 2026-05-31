import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ListResponse } from '../../common/interceptors/list.interceptor';
import { toListResponse } from '../../common/pagination';
import type { AuthUser } from '../../common/types/authenticated-request';
import { CardsService } from './cards.service';
import {
  CardListDto,
  CardListQueryDto,
  type CardResponse,
  CardResponseDto,
  CreateCardDto,
  UpdateCardDto,
} from './dto/card.dto';

@ApiTags('cards')
@ApiBearerAuth()
@Controller('cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  @ApiOkResponse({ type: CardListDto })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: CardListQueryDto
  ): ListResponse<CardResponse> {
    const { rows, limit } = this.cards.list(user.id, query);
    return toListResponse(rows, limit);
  }

  @Post()
  @HttpCode(201)
  @ApiOkResponse({ type: CardResponseDto })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateCardDto): CardResponse {
    return this.cards.create(user.id, body);
  }

  @Get(':id')
  @ApiOkResponse({ type: CardResponseDto })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): CardResponse {
    return this.cards.get(user.id, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CardResponseDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateCardDto
  ): CardResponse {
    return this.cards.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): void {
    this.cards.remove(user.id, id);
  }
}
