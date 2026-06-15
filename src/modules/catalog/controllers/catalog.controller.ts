import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ServiceCategory } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { Public } from '../../../common/decorators/public.decorator';
import {
  CatalogService,
  CategoryDto,
  QuarterDto,
  ServiceItemDto,
} from '../services/catalog.service';

class ListServicesQuery {
  @IsOptional()
  @IsEnum(ServiceCategory, { message: 'Catégorie inconnue.' })
  category?: ServiceCategory;
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
  @Get('quarters')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(3_600_000)
  @ApiOperation({
    summary:
      'Quartiers de référence d’Abidjan (source de vérité, triés par nom).',
  })
  @ApiOkResponse({
    schema: {
      example: [
        { slug: 'yopougon', name: 'Yopougon' },
        { slug: 'yopougon-selmer', name: 'Yopougon Selmer' },
      ],
    },
  })
  quarters(): QuarterDto[] {
    return this.catalog.quarters();
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
