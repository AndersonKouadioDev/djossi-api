import { Module } from '@nestjs/common';
import { StorageModule } from '../../integrations/storage/storage.module';
import { ProviderProfileService } from './provider-profile.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [StorageModule],
  controllers: [UsersController],
  providers: [UsersService, ProviderProfileService],
})
export class UsersModule {}
