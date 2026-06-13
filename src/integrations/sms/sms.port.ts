/**
 * Port d'envoi de SMS. Adapter dev : console. Adapter prod à venir : Twilio.
 * Classe abstraite (et non interface) pour servir de token d'injection Nest.
 */
export abstract class SmsPort {
  abstract sendOtp(phone: string, code: string): Promise<void>;
}
