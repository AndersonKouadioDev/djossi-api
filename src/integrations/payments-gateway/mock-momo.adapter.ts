import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../core/config/env';
import {
  CreateCheckoutParams,
  CreateCheckoutResult,
  InitiatePaymentParams,
  InitiatePaymentResult,
  PaymentGatewayPort,
  SettlementEvent,
  SettlementHandler,
} from './payment-gateway.port';

/**
 * Mock Mobile Money :
 * - cash → completed immédiatement ;
 * - orange_money / mtn_momo / wave → pending, puis webhook simulé après
 *   PAYMENT_MOCK_AUTOCOMPLETE_MS (0 = synchrone, pour les tests) ;
 * - convention de test : un numéro finissant par "00" → échec "Solde insuffisant".
 */
@Injectable()
export class MockMomoAdapter
  extends PaymentGatewayPort
  implements OnModuleDestroy
{
  private readonly logger = new Logger('MockMomo');
  private readonly autocompleteMs: number;
  private readonly publicBaseUrl: string;
  private readonly timers = new Set<NodeJS.Timeout>();
  private handler: SettlementHandler | null = null;

  constructor(config: ConfigService<Env, true>) {
    super();
    this.autocompleteMs = config.get('PAYMENT_MOCK_AUTOCOMPLETE_MS', {
      infer: true,
    });
    this.publicBaseUrl = config.get('PUBLIC_BASE_URL', { infer: true });
  }

  onSettlement(handler: SettlementHandler): void {
    this.handler = handler;
  }

  /**
   * Checkout factice : renvoie l'URL d'une page de paiement simulée servie par
   * le backend (`GET /payments/mock-checkout/:reference`). Aucun appel réseau,
   * aucun débit réel — pour tester le flux webview de bout en bout.
   */
  async createCheckout(
    params: CreateCheckoutParams,
  ): Promise<CreateCheckoutResult> {
    const base = this.publicBaseUrl.replace(/\/$/, '');
    const q = new URLSearchParams({
      amount: String(params.amountFcfa),
      ok: params.successUrl,
      err: params.errorUrl,
    });
    return {
      sessionId: params.reference,
      launchUrl: `${base}/v1/payments/mock-checkout/${params.reference}?${q.toString()}`,
    };
  }

  async initiate(
    params: InitiatePaymentParams,
  ): Promise<InitiatePaymentResult> {
    if (params.method === 'cash') {
      return { status: 'completed' };
    }

    const event: SettlementEvent = params.phoneNumber?.endsWith('00')
      ? {
          reference: params.reference,
          status: 'failed',
          failureReason: 'Solde insuffisant',
        }
      : { reference: params.reference, status: 'completed' };

    if (this.autocompleteMs === 0) {
      await this.settle(event);
    } else {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        void this.settle(event);
      }, this.autocompleteMs);
      this.timers.add(timer);
    }
    return { status: 'pending' };
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  private async settle(event: SettlementEvent): Promise<void> {
    if (!this.handler) return;
    try {
      await this.handler(event);
      this.logger.log(`Webhook simulé : ${event.reference} → ${event.status}`);
    } catch (error) {
      this.logger.error(
        `Webhook simulé en échec pour ${event.reference}`,
        error,
      );
    }
  }
}
