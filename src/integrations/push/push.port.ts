export interface PushPayload {
  title?: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Port de notifications push. Adapter dev : no-op (log).
 * Adapter prod à venir : Firebase Cloud Messaging via les Devices enregistrés.
 */
export abstract class PushPort {
  abstract sendToUser(userId: string, payload: PushPayload): Promise<void>;
}
