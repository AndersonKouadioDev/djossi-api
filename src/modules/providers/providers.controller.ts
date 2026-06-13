import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Page } from '../../common/dto/page';
import {
  ProviderDetailDto,
  ProviderSearchPageDto,
  ProviderSummaryDto,
} from './dto/provider-response.dtos';
import { SearchProvidersQuery } from './dto/search-providers.query';
import { ProvidersService } from './providers.service';

@ApiTags('providers')
@ApiBearerAuth()
@Controller()
export class ProvidersController {
  constructor(private readonly providers: ProvidersService) {}

  @Get('search/providers')
  @ApiOperation({
    summary: 'Recherche de prestataires (texte, catégorie, quartier).',
  })
  @ApiOkResponse({ type: ProviderSearchPageDto })
  search(
    @CurrentUser() user: AuthUser,
    @Query() query: SearchProvidersQuery,
  ): Promise<Page<ProviderSummaryDto>> {
    return this.providers.search(query, user);
  }

  @Get('providers')
  @ApiOperation({ summary: 'Liste paginée des prestataires (mêmes filtres).' })
  @ApiOkResponse({ type: ProviderSearchPageDto })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: SearchProvidersQuery,
  ): Promise<Page<ProviderSummaryDto>> {
    return this.providers.search(query, user);
  }

  @Get('providers/:id')
  @ApiOperation({ summary: 'Fiche détaillée d’un prestataire.' })
  @ApiOkResponse({ type: ProviderDetailDto })
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<ProviderDetailDto> {
    return this.providers.detail(id, user);
  }
}
