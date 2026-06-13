import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import {
  CreateTicketDto,
  ReplyTicketDto,
  SupportMessageDto,
  SupportTicketDetailDto,
  SupportTicketDto,
} from './dto/support.dtos';
import { SupportService } from './support.service';

@ApiTags('support')
@ApiBearerAuth()
@Controller('support/tickets')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post()
  @UseGuards(ActiveUserGuard)
  @ApiOperation({
    summary: 'Ouvre un ticket de support (crée le ticket + 1er message).',
  })
  @ApiCreatedResponse({ type: SupportTicketDetailDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTicketDto,
  ): Promise<SupportTicketDetailDto> {
    return this.support.createTicket(user, dto.subject, dto.message);
  }

  @Get()
  @ApiOperation({
    summary: 'Mes tickets (plus récents d’abord, avec le dernier message).',
  })
  @ApiOkResponse({ type: [SupportTicketDto] })
  list(@CurrentUser() user: AuthUser): Promise<SupportTicketDto[]> {
    return this.support.listTickets(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un ticket + tous ses messages.' })
  @ApiOkResponse({ type: SupportTicketDetailDto })
  get(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<SupportTicketDetailDto> {
    return this.support.getTicket(user, id);
  }

  @Post(':id/messages')
  @UseGuards(ActiveUserGuard)
  @ApiOperation({ summary: 'Répond dans un ticket (message côté utilisateur).' })
  @ApiCreatedResponse({ type: SupportMessageDto })
  reply(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReplyTicketDto,
  ): Promise<SupportMessageDto> {
    return this.support.reply(user, id, dto.body);
  }
}
