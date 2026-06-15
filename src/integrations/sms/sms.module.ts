import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../core/config/env';
import { ConsoleSmsAdapter } from './console-sms.adapter';
import { SmsPort } from './sms.port';
import { TwilioSmsAdapter } from './twilio-sms.adapter';

@Module({
  providers: [
    {
      // Adapter sélectionné par l'environnement : Twilio si les trois creds
      // (SID, token, expéditeur) sont présentes, sinon fallback console (dev/tests).
      provide: SmsPort,
      useFactory: (config: ConfigService<Env, true>): SmsPort => {
        const sid = config.get('TWILIO_ACCOUNT_SID', { infer: true });
        const token = config.get('TWILIO_AUTH_TOKEN', { infer: true });
        const sender = config.get('TWILIO_SENDER', { infer: true });
        return sid && token && sender
          ? new TwilioSmsAdapter(sid, token, sender)
          : new ConsoleSmsAdapter();
      },
      inject: [ConfigService],
    },
  ],
  exports: [SmsPort],
})
export class SmsModule {}
