import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { NotificationDto, RegisterDeviceDto } from '../dto/notification.dtos';
import {
  NotificationPage,
  NotificationsService,
} from '../services/notifications.service';

class ListNotificationsQuery extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unread_only?: boolean;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Notifications du compte (plus récentes d’abord).' })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListNotificationsQuery,
  ): Promise<NotificationPage> {
    return this.notifications.list(
      user.id,
      query.limit,
      query.offset,
      query.unread_only ?? false,
    );
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marque une notification comme lue.' })
  @ApiOkResponse({ type: NotificationDto })
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<NotificationDto> {
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marque toutes les notifications comme lues.' })
  markAllRead(@CurrentUser() user: AuthUser): Promise<{ count: number }> {
    return this.notifications.markAllRead(user.id);
  }

  @Post('devices')
  @ApiOperation({ summary: 'Enregistre le token FCM de l’appareil.' })
  @ApiCreatedResponse({ schema: { example: { id: 'device-id' } } })
  registerDevice(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterDeviceDto,
  ): Promise<{ id: string }> {
    return this.notifications.registerDevice(
      user.id,
      dto.fcm_token,
      dto.platform,
    );
  }

  @Delete('devices/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Désenregistre le token FCM de l’appareil.' })
  @ApiNoContentResponse()
  unregisterDevice(
    @CurrentUser() user: AuthUser,
    @Param('token') token: string,
  ): Promise<void> {
    return this.notifications.unregisterDevice(user.id, token);
  }
}
