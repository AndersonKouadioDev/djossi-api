import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CreateReviewDto, ReviewDto } from './dto/review.dtos';
import { ProviderReviewsPage, ReviewsService } from './reviews.service';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('reviews')
  @UseGuards(ActiveUserGuard)
  @ApiOperation({
    summary: 'Laisse un avis (1 par réservation, mission terminée uniquement).',
  })
  @ApiCreatedResponse({ type: ReviewDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewDto> {
    return this.reviews.create(user, dto);
  }

  @Get('providers/:id/reviews')
  @ApiOperation({ summary: 'Avis reçus par un prestataire.' })
  listForProvider(
    @Param('id') providerId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<ProviderReviewsPage> {
    return this.reviews.listForProvider(providerId, query.limit, query.offset);
  }
}
