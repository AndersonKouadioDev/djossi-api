import { Injectable, Logger } from '@nestjs/common';
import twilio, { Twilio } from 'twilio';
import { SmsPort } from './sms.port';

/**
 * Adapter d'envoi de SMS via Twilio (production). Actif uniquement si les trois
 * variables TWILIO_* sont présentes (sinon SmsModule retombe sur la console).
 *
 * L'OTP reste vérifiable côté serveur même si l'envoi échoue : on logge l'erreur
 * sans la propager pour ne pas bloquer la requête HTTP d'authentification.
 */
@Injectable()
export class TwilioSmsAdapter extends SmsPort {
  private readonly logger = new Logger('SMS');
  private readonly client: Twilio;

  constructor(
    accountSid: string,
    authToken: string,
    private readonly sender: string,
  ) {
    super();
    this.client = twilio(accountSid, authToken);
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    try {
      await this.client.messages.create({
        to: phone,
        from: this.sender,
        body: `Ton code DJOSSI : ${code} (valide 5 min).`,
      });
    } catch (error) {
      // Envoi best-effort : on ne bloque pas l'authentification si Twilio échoue.
      this.logger.error(`Échec envoi SMS Twilio à ${phone}`, error);
    }
  }
}
