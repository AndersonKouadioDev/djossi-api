import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ServiceCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Public } from '../../../common/decorators/public.decorator';
import {
  CatalogService,
  CategoryDto,
  CityDto,
  QuarterDto,
  ServiceItemDto,
  TradeDto,
} from '../services/catalog.service';

class ListServicesQuery {
  @IsOptional()
  @IsEnum(ServiceCategory, { message: 'Catégorie inconnue.' })
  category?: ServiceCategory;
}

class ListQuartersQuery {
  @IsOptional()
  @IsString()
  city?: string;
}

@ApiTags('catalog')
@Controller('services')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get('categories')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300_000)
  @ApiOperation({ summary: 'Les 12 catégories de métiers (label + emoji).' })
  @ApiOkResponse({
    schema: {
      example: [
        { slug: 'soudeur', label: 'Soudeur', emoji: '🔨', sort_order: 0 },
      ],
    },
  })
  categories(): Promise<CategoryDto[]> {
    return this.catalog.categories();
  }

  @Public()
  @Get('trades')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(3_600_000)
  @ApiOperation({
    summary:
      'Catalogue de métiers ivoiriens (12 catégories puis métiers spécialisés), triés par sort_order.',
  })
  @ApiOkResponse({
    schema: {
      example: [
        { slug: 'soudeur', label: 'Soudeur', category: 'soudeur', sort_order: 0 },
        {
          slug: 'ferronnier',
          label: 'Ferronnier',
          category: 'soudeur',
          sort_order: 12,
        },
      ],
    },
  })
  trades(): TradeDto[] {
    return this.catalog.trades();
  }

  @Public()
  @Get('cities')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(3_600_000)
  @ApiOperation({
    summary: 'Principales villes de Côte d’Ivoire (Abidjan en premier).',
  })
  @ApiOkResponse({
    schema: {
      example: [
        { slug: 'abidjan', name: 'Abidjan' },
        { slug: 'bouake', name: 'Bouaké' },
      ],
    },
  })
  cities(): CityDto[] {
    return this.catalog.cities();
  }

  @Public()
  @Get('quarters')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(3_600_000)
  @ApiOperation({
    summary:
      'Quartiers de référence d’une ville (triés par nom). `city` optionnel, défaut `abidjan`.',
  })
  @ApiQuery({
    name: 'city',
    required: false,
    description:
      'Slug de la ville (ex. `abidjan`, `bouake`). Absent ou inconnu → Abidjan.',
  })
  @ApiOkResponse({
    schema: {
      example: [
        { slug: 'yopougon', name: 'Yopougon' },
        { slug: 'yopougon-selmer', name: 'Yopougon Selmer' },
      ],
    },
  })
  quarters(@Query() query: ListQuartersQuery): QuarterDto[] {
    return this.catalog.quarters(query.city);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Catalogue des libellés de services par catégorie.',
  })
  @ApiQuery({ name: 'category', required: false, enum: ServiceCategory })
  services(@Query() query: ListServicesQuery): Promise<ServiceItemDto[]> {
    return this.catalog.services(query.category);
  }
}
