import { Injectable, Logger } from '@nestjs/common';
import { SmsPort } from './sms.port';

@Injectable()
export class ConsoleSmsAdapter extends SmsPort {
  private readonly logger = new Logger('SMS');

  sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(`OTP pour ${phone} : ${code} (valide 5 min)`);
    return Promise.resolve();
  }
}
