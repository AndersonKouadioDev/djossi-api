import { Module } from '@nestjs/common';
import { NoopPushAdapter } from './noop-push.adapter';
import { PushPort } from './push.port';

@Module({
  providers: [{ provide: PushPort, useClass: NoopPushAdapter }],
  exports: [PushPort],
})
export class PushModule {}
