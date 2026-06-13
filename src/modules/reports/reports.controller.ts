import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { CreateReportDto, ReportDto } from './dto/report.dtos';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @UseGuards(ActiveUserGuard)
  @ApiOperation({
    summary:
      'Signale un utilisateur (auto-modération : 2 reporters → avertissement, 3 → suspension).',
  })
  @ApiCreatedResponse({ type: ReportDto })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReportDto,
  ): Promise<ReportDto> {
    return this.reports.create(user, dto);
  }
}
