import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../core/config/env';
import { MockMomoAdapter } from './mock-momo.adapter';
import { PaymentGatewayPort } from './payment-gateway.port';
import { WaveCheckoutAdapter } from './wave-checkout.adapter';

@Module({
  providers: [
    MockMomoAdapter,
    WaveCheckoutAdapter,
    {
      // Adapter sélectionné par PAYMENT_GATEWAY ("mock" par défaut).
      provide: PaymentGatewayPort,
      useFactory: (
        config: ConfigService<Env, true>,
        mock: MockMomoAdapter,
        wave: WaveCheckoutAdapter,
      ): PaymentGatewayPort =>
        config.get('PAYMENT_GATEWAY', { infer: true }) === 'wave'
          ? wave
          : mock,
      inject: [ConfigService, MockMomoAdapter, WaveCheckoutAdapter],
    },
  ],
  exports: [PaymentGatewayPort],
})
export class PaymentsGatewayModule {}
