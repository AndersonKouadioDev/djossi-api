import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Put,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import {
  ProviderProfileDto,
  UpsertProviderProfileDto,
} from '../dto/provider-profile.dtos';
import { ReferralDto } from '../dto/referral.dto';
import { UpdateMeDto } from '../dto/update-me.dto';
import { UserDto } from '../dto/user.dto';
import { ProviderProfileService } from '../services/provider-profile.service';
import { UsersService } from '../services/users.service';

const AVATAR_VALIDATORS = new ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({
      maxSize: 5 * 1024 * 1024,
      message: 'Image trop lourde (5 Mo max).',
    }),
    new FileTypeValidator({ fileType: /(jpeg|png|webp)$/ }),
  ],
});

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly providerProfile: ProviderProfileService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Profil de l’utilisateur connecté.' })
  @ApiOkResponse({ type: UserDto })
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.users.me(user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Met à jour le profil.' })
  @ApiOkResponse({ type: UserDto })
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMeDto,
  ): Promise<UserDto> {
    return this.users.updateMe(user.id, dto);
  }

  @Post('avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Upload la photo de profil (jpeg/png/webp, 5 Mo max).',
  })
  @ApiOkResponse({
    schema: { example: { avatar_url: 'http://…/uploads/avatars/x.jpg' } },
  })
  uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile(AVATAR_VALIDATORS) file: Express.Multer.File,
  ): Promise<{ avatar_url: string }> {
    return this.users.setAvatar(user.id, file);
  }

  @Get('referral')
  @ApiOperation({
    summary: 'Code de parrainage et message de partage de l’utilisateur.',
  })
  @ApiOkResponse({ type: ReferralDto })
  referral(@CurrentUser() user: AuthUser): Promise<ReferralDto> {
    return this.users.referral(user.id);
  }

  // ---------- Profil prestataire ----------

  @Get('provider')
  @ApiOperation({ summary: 'Profil prestataire de l’utilisateur connecté.' })
  @ApiOkResponse({ type: ProviderProfileDto })
  myProviderProfile(
    @CurrentUser() user: AuthUser,
  ): Promise<ProviderProfileDto> {
    return this.providerProfile.getMine(user.id);
  }

  @Post('provider')
  @ApiOperation({ summary: 'Crée le profil prestataire (onboarding).' })
  @ApiCreatedResponse({ type: ProviderProfileDto })
  createProviderProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertProviderProfileDto,
  ): Promise<ProviderProfileDto> {
    return this.providerProfile.create(user.id, dto);
  }

  @Put('provider')
  @ApiOperation({ summary: 'Met à jour le profil prestataire.' })
  @ApiOkResponse({ type: ProviderProfileDto })
  updateProviderProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertProviderProfileDto,
  ): Promise<ProviderProfileDto> {
    return this.providerProfile.update(user.id, dto);
  }

  @Post('provider/portfolio')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('files', 6))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({ summary: 'Ajoute jusqu’à 6 photos de réalisations.' })
  @ApiOkResponse({ type: ProviderProfileDto })
  addPortfolio(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ProviderProfileDto> {
    return this.providerProfile.addPortfolioPhotos(user.id, files ?? []);
  }

  @Delete('provider/portfolio/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime une photo de réalisations.' })
  @ApiNoContentResponse()
  removePortfolioPhoto(
    @CurrentUser() user: AuthUser,
    @Param('photoId') photoId: string,
  ): Promise<void> {
    return this.providerProfile.removePortfolioPhoto(user.id, photoId);
  }
}
