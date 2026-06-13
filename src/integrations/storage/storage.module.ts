import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../core/config/env';
import { LocalDiskStorageAdapter } from './local-disk.adapter';
import { S3StorageAdapter } from './s3.adapter';
import { StoragePort } from './storage.port';

@Module({
  providers: [
    LocalDiskStorageAdapter,
    S3StorageAdapter,
    {
      // Adapter sélectionné par STORAGE_DRIVER ("local" par défaut).
      provide: StoragePort,
      useFactory: (
        config: ConfigService<Env, true>,
        local: LocalDiskStorageAdapter,
        s3: S3StorageAdapter,
      ): StoragePort =>
        config.get('STORAGE_DRIVER', { infer: true }) === 's3' ? s3 : local,
      inject: [ConfigService, LocalDiskStorageAdapter, S3StorageAdapter],
    },
  ],
  exports: [StoragePort],
})
export class StorageModule {}
