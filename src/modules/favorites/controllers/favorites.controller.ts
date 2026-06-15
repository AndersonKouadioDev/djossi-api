import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { ActiveUserGuard } from '../../../common/guards/active-user.guard';
import { ProviderSummaryDto } from '../../providers/dto/provider-response.dtos';
import { AddFavoriteDto } from '../dto/add-favorite.dto';
import { FavoritesService } from '../services/favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@Controller('users/me/favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOperation({
    summary: 'Mes prestataires favoris (plus récents d’abord).',
  })
  @ApiOkResponse({ type: [ProviderSummaryDto] })
  list(@CurrentUser() user: AuthUser): Promise<ProviderSummaryDto[]> {
    return this.favorites.list(user);
  }

  @Post()
  @UseGuards(ActiveUserGuard)
  @ApiOperation({ summary: 'Ajoute un prestataire à mes favoris.' })
  @ApiCreatedResponse({ type: ProviderSummaryDto })
  add(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddFavoriteDto,
  ): Promise<ProviderSummaryDto> {
    return this.favorites.add(user, dto.provider_id);
  }

  @Delete(':provider_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Retire un prestataire de mes favoris.' })
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthUser,
    @Param('provider_id') providerId: string,
  ): Promise<void> {
    return this.favorites.remove(user, providerId);
  }
}
