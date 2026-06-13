import { Injectable, Logger } from '@nestjs/common';
import { PushPayload, PushPort } from './push.port';

@Injectable()
export class NoopPushAdapter extends PushPort {
  private readonly logger = new Logger('Push');

  sendToUser(userId: string, payload: PushPayload): Promise<void> {
    this.logger.debug(`Push (no-op) → ${userId} : ${payload.body}`);
    return Promise.resolve();
  }
}
