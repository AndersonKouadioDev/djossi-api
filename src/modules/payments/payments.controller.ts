import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExcludeEndpoint,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Page } from '../../common/dto/page';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import {
  CheckoutDepositDto,
  CheckoutSessionDto,
  InitPaymentDto,
  PaymentCallbackDto,
  PaymentDto,
} from './dto/payment.dtos';
import { PaymentsService } from './payments.service';

/** Échappe le HTML pour l'injection dans la page de paiement factice. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('init')
  @UseGuards(ActiveUserGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Initie un paiement (cash → completed direct ; mobile money → pending puis webhook).',
  })
  @ApiCreatedResponse({ type: PaymentDto })
  init(
    @CurrentUser() user: AuthUser,
    @Body() dto: InitPaymentDto,
  ): Promise<PaymentDto> {
    return this.payments.init(user, dto);
  }

  @Post('checkout')
  @UseGuards(ActiveUserGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Paie l'acompte (Wave Checkout) pour confirmer une réservation. " +
      "Retourne launch_url à ouvrir en webview.",
  })
  @ApiOkResponse({ type: CheckoutSessionDto })
  checkout(
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckoutDepositDto,
  ): Promise<CheckoutSessionDto> {
    return this.payments.checkout(user, dto);
  }

  @Public()
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: 'x-webhook-secret', required: true })
  @ApiOperation({
    summary: 'Webhook fournisseur Mobile Money (signé, idempotent).',
  })
  callback(
    @Body() dto: PaymentCallbackDto,
    @Headers('x-webhook-secret') secret: string | undefined,
  ): Promise<{ message: string }> {
    return this.payments.handleCallback(dto, secret);
  }

  @Public()
  @Post('wave/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async waveWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('wave-signature') signature: string | undefined,
  ): Promise<{ received: boolean }> {
    const raw = req.rawBody?.toString('utf-8') ?? '';
    await this.payments.handleWaveWebhook(raw, signature);
    return { received: true };
  }

  // --- Page de paiement factice (dev, PAYMENT_GATEWAY=mock) ---

  @Public()
  @Get('mock-checkout/:reference')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiExcludeEndpoint()
  mockCheckoutPage(
    @Param('reference') reference: string,
    @Query('amount') amount = '',
    @Query('ok') ok = '',
    @Query('err') err = '',
  ): string {
    const amt = escapeHtml(amount);
    const ref = escapeHtml(reference);
    // URLs injectées en littéral JS (sûr) ; affichage HTML échappé.
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Paiement Wave (simulation)</title><style>
body{font-family:-apple-system,system-ui,sans-serif;margin:0;background:#FAF7F2;color:#1A1A1A;display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{background:#fff;border:1px solid #ECE7DF;border-radius:20px;padding:28px;width:300px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.06)}
.tag{font-size:11px;letter-spacing:.08em;color:#9A958C;text-transform:uppercase}
.amt{font-size:34px;font-weight:800;margin:8px 0 2px}.sub{font-size:12px;color:#6B6B6B;margin-bottom:22px}
button{width:100%;border:0;border-radius:14px;padding:14px;font-size:15px;font-weight:700;cursor:pointer}
.pay{background:#FF6A1F;color:#fff;margin-bottom:10px}.cancel{background:#fff;color:#6B6B6B;border:1px solid #ECE7DF}
</style></head><body><div class="card">
<div class="tag">Wave · Simulation</div><div class="amt">${amt} F</div>
<div class="sub">Acompte de réservation</div>
<button class="pay" onclick="pay(true)">Payer (simulation)</button>
<button class="cancel" onclick="pay(false)">Annuler</button></div>
<script>var OK=${JSON.stringify(ok)},ERR=${JSON.stringify(err)};
async function pay(s){try{await fetch(location.pathname+'/settle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({success:s})});}catch(e){}location.href=s?OK:ERR;}
</script></body></html>`;
  }

  @Public()
  @Post('mock-checkout/:reference/settle')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async mockCheckoutSettle(
    @Param('reference') reference: string,
    @Body() body: { success?: boolean },
  ): Promise<{ ok: boolean }> {
    await this.payments.confirmMockCheckout(reference, body?.success !== false);
    return { ok: true };
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Historique de mes paiements.' })
  history(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Page<PaymentDto>> {
    return this.payments.history(user, query.limit, query.offset);
  }
}
