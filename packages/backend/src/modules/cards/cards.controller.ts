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
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: CardListQueryDto
  ): Promise<ListResponse<CardResponse>> {
    const { rows, limit } = await this.cards.list(user.id, query);
    return toListResponse(rows, limit);
  }

  @Post()
  @HttpCode(201)
  @ApiOkResponse({ type: CardResponseDto })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateCardDto): Promise<CardResponse> {
    return this.cards.create(user.id, body);
  }

  @Get(':id')
  @ApiOkResponse({ type: CardResponseDto })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<CardResponse> {
    return this.cards.get(user.id, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CardResponseDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateCardDto
  ): Promise<CardResponse> {
    return this.cards.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.cards.remove(user.id, id);
  }
}
