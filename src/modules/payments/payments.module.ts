import { Module } from '@nestjs/common';
import { PaymentsGatewayModule } from '../../integrations/payments-gateway/payments-gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentsService } from './services/payments.service';

@Module({
  imports: [PaymentsGatewayModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
