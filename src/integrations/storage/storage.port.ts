export interface SaveFileOptions {
  /** Sous-dossier logique : "avatars", "portfolio"… */
  folder: string;
  mime: string;
}

export interface StoredFile {
  /** URL publique absolue du fichier. */
  url: string;
}

/**
 * Port de stockage de fichiers. Adapter dev : disque local servi sur /uploads.
 * Adapter prod à venir : Cloudinary (les URLs restent absolues dans les deux cas).
 */
export abstract class StoragePort {
  abstract save(buffer: Buffer, options: SaveFileOptions): Promise<StoredFile>;
  abstract delete(url: string): Promise<void>;
}
