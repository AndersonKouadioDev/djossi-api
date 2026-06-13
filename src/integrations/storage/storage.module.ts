import { Module } from '@nestjs/common';
import { LocalDiskStorageAdapter } from './local-disk.adapter';
import { StoragePort } from './storage.port';

@Module({
  providers: [{ provide: StoragePort, useClass: LocalDiskStorageAdapter }],
  exports: [StoragePort],
})
export class StorageModule {}
