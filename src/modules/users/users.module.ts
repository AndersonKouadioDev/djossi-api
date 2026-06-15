import { Module } from '@nestjs/common';
import { StorageModule } from '../../integrations/storage/storage.module';
import { ProviderProfileService } from './services/provider-profile.service';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';

@Module({
  imports: [StorageModule],
  controllers: [UsersController],
  providers: [UsersService, ProviderProfileService],
})
export class UsersModule {}
