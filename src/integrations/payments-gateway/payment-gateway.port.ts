import { PaymentMethod } from '@prisma/client';

export interface InitiatePaymentParams {
  /** Référence interne Djossi ("PAY-…"), transmise au fournisseur. */
  reference: string;
  amountFcfa: number;
  method: PaymentMethod;
  /** Numéro Mobile Money à débiter (sans objet pour cash). */
  phoneNumber?: string | null;
}

export interface InitiatePaymentResult {
  /** cash → completed immédiat ; mobile money → pending puis webhook. */
  status: 'pending' | 'completed';
}

export interface SettlementEvent {
  reference: string;
  status: 'completed' | 'failed';
  failureReason?: string;
}

export type SettlementHandler = (event: SettlementEvent) => Promise<void>;

/** Création d'une session de paiement hébergée (modèle "checkout" Wave). */
export interface CreateCheckoutParams {
  /** Référence interne Djossi ("PAY-…") = client_reference côté fournisseur. */
  reference: string;
  amountFcfa: number;
  /** URLs HTTPS de retour (interceptées par la webview de l'app). */
  successUrl: string;
  errorUrl: string;
}

export interface CreateCheckoutResult {
  /** Identifiant de session du fournisseur. */
  sessionId: string;
  /** URL à ouvrir dans la webview pour payer. */
  launchUrl: string;
}

/**
 * Port d'encaissement. Deux modèles :
 * - `initiate` : push Mobile Money (numéro débité, règlement par webhook) ;
 * - `createCheckout` : session hébergée (Wave Checkout → launch_url + webhook).
 *
 * Adapter dev : mock (simule le webhook / sert une page de paiement factice).
 * Adapter prod : Wave.
 */
export abstract class PaymentGatewayPort {
  abstract initiate(
    params: InitiatePaymentParams,
  ): Promise<InitiatePaymentResult>;

  /** Crée une session de paiement hébergée et retourne l'URL à ouvrir. */
  abstract createCheckout(
    params: CreateCheckoutParams,
  ): Promise<CreateCheckoutResult>;

  /** Enregistre le handler appelé quand le fournisseur notifie le règlement. */
  abstract onSettlement(handler: SettlementHandler): void;
}
