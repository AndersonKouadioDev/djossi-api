import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Page } from '../../common/dto/page';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import {
  ConversationDto,
  CreateConversationDto,
  MessageDto,
  SendMessageDto,
} from './dto/messaging.dtos';
import { MessagingService } from './messaging.service';

@ApiTags('messaging')
@ApiBearerAuth()
@Controller('messages/conversations')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Post()
  @UseGuards(ActiveUserGuard)
  @ApiOperation({
    summary:
      'Ouvre (ou retrouve, idempotent) la conversation avec un prestataire.',
  })
  @ApiCreatedResponse({ type: ConversationDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateConversationDto,
  ): Promise<ConversationDto> {
    return this.messaging.createConversation(user, dto.provider_id);
  }

  @Get()
  @ApiOperation({ summary: 'Mes conversations (les deux côtés du compte).' })
  @ApiOkResponse({ type: [ConversationDto] })
  list(@CurrentUser() user: AuthUser): Promise<ConversationDto[]> {
    return this.messaging.listConversations(user);
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: 'Messages d’une conversation (chronologique) — marque comme lus.',
  })
  messages(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<MessageDto>> {
    return this.messaging.listMessages(user, id, query.limit, query.offset);
  }

  @Post(':id/messages')
  @UseGuards(ActiveUserGuard)
  @ApiOperation({ summary: 'Envoie un message texte.' })
  @ApiCreatedResponse({ type: MessageDto })
  send(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageDto> {
    return this.messaging.sendMessage(user, id, dto.text);
  }
}
