import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsController } from './controllers/bookings.controller';
import { BookingsService } from './services/bookings.service';

@Module({
  imports: [NotificationsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
