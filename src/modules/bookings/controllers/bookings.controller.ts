import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { Page } from '../../../common/dto/page';
import { ActiveUserGuard } from '../../../common/guards/active-user.guard';
import {
  BookingDto,
  CreateBookingDto,
  ListBookingsQuery,
  UpdateBookingStatusDto,
} from '../dto/booking.dtos';
import { BookingsService } from '../services/bookings.service';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @UseGuards(ActiveUserGuard)
  @ApiOperation({ summary: 'Crée une demande de réservation.' })
  @ApiCreatedResponse({ type: BookingDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingDto> {
    return this.bookings.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Mes réservations (côté client ou prestataire).' })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListBookingsQuery,
  ): Promise<Page<BookingDto>> {
    return this.bookings.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’une réservation.' })
  @ApiOkResponse({ type: BookingDto })
  detail(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<BookingDto> {
    return this.bookings.detail(user, id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Statut courant d’une réservation.' })
  status(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<{ id: string; status: BookingStatus }> {
    return this.bookings.status(user, id);
  }

  @Patch(':id/status')
  @UseGuards(ActiveUserGuard)
  @ApiOperation({
    summary:
      'Transition de statut (pending→confirmed/cancelled, confirmed→in_progress/cancelled, in_progress→completed).',
  })
  @ApiOkResponse({ type: BookingDto })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
  ): Promise<BookingDto> {
    return this.bookings.updateStatus(user, id, dto);
  }
}
