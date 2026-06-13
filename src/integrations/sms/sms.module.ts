import { Module } from '@nestjs/common';
import { ConsoleSmsAdapter } from './console-sms.adapter';
import { SmsPort } from './sms.port';

@Module({
  providers: [{ provide: SmsPort, useClass: ConsoleSmsAdapter }],
  exports: [SmsPort],
})
export class SmsModule {}
