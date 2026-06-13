import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../core/config/env';
import {
  CreateCheckoutParams,
  CreateCheckoutResult,
  InitiatePaymentParams,
  InitiatePaymentResult,
  PaymentGatewayPort,
  SettlementHandler,
} from './payment-gateway.port';

const WAVE_CHECKOUT_URL = 'https://api.wave.com/v1/checkout/sessions';

interface WaveSession {
  id: string;
  wave_launch_url: string;
}

/**
 * Adapter Wave Checkout (production). Actif uniquement si PAYMENT_GATEWAY=wave.
 * Le règlement n'arrive PAS ici : il est notifié par le webhook Wave
 * (`POST /payments/wave/webhook`), source de vérité du paiement.
 */
@Injectable()
export class WaveCheckoutAdapter extends PaymentGatewayPort {
  private readonly logger = new Logger('WaveCheckout');
  private readonly apiKey: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    // Validé au boot par env.ts (requis quand PAYMENT_GATEWAY=wave).
    this.apiKey = config.get('WAVE_API_KEY', { infer: true }) ?? '';
  }

  async createCheckout(
    params: CreateCheckoutParams,
  ): Promise<CreateCheckoutResult> {
    let response: Response;
    try {
      response = await fetch(WAVE_CHECKOUT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // XOF = 0 décimale : le montant FCFA est un entier en chaîne.
          amount: String(params.amountFcfa),
          currency: 'XOF',
          success_url: params.successUrl,
          error_url: params.errorUrl,
          client_reference: params.reference,
        }),
      });
    } catch (error) {
      this.logger.error('Wave injoignable', error);
      throw new ServiceUnavailableException('Paiement indisponible (réseau).');
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Wave checkout ${response.status} : ${body}`);
      throw new ServiceUnavailableException(
        'Impossible de créer la session de paiement.',
      );
    }

    const session = (await response.json()) as WaveSession;
    return { sessionId: session.id, launchUrl: session.wave_launch_url };
  }

  initiate(_params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    // Wave Checkout n'utilise pas le push Mobile Money : passer par createCheckout.
    return Promise.reject(
      new ServiceUnavailableException(
        'Wave utilise le checkout hébergé (createCheckout).',
      ),
    );
  }

  onSettlement(_handler: SettlementHandler): void {
    // Le règlement Wave provient du webhook, pas d'un handler interne.
  }
}
