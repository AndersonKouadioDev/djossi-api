import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { Env } from '../../core/config/env';
import { SaveFileOptions, StoragePort, StoredFile } from './storage.port';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Adapter de stockage S3-compatible (production). Actif uniquement si
 * STORAGE_DRIVER=s3. Compatible AWS S3 et tout service S3 (MinIO, Scaleway,
 * Cloudflare R2…) via S3_ENDPOINT. Les URLs publiques restent absolues, comme
 * pour l'adapter disque local, pour ne rien changer côté app.
 */
@Injectable()
export class S3StorageAdapter extends StoragePort {
  private readonly logger = new Logger('S3Storage');
  private readonly client: S3Client;
  private readonly bucket: string;
  /** Base des URLs publiques : "{endpoint}/{bucket}" sans slash final. */
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    // Toutes validées au boot par env.ts (requises quand STORAGE_DRIVER=s3).
    const endpoint = (config.get('S3_ENDPOINT', { infer: true }) ?? '').replace(
      /\/$/,
      '',
    );
    this.bucket = config.get('S3_BUCKET', { infer: true }) ?? '';
    this.client = new S3Client({
      region: config.get('S3_REGION', { infer: true }) ?? 'us-east-1',
      endpoint: endpoint || undefined,
      // Indispensable pour la plupart des S3 self-hosted (MinIO, R2…).
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }) ?? '',
        secretAccessKey: config.get('S3_SECRET', { infer: true }) ?? '',
      },
    });
    this.publicBaseUrl = `${endpoint}/${this.bucket}`;
  }

  async save(buffer: Buffer, options: SaveFileOptions): Promise<StoredFile> {
    const ext = EXT_BY_MIME[options.mime];
    if (!ext) {
      throw new BadRequestException(
        'Format de fichier non supporté (jpeg, png ou webp attendu).',
      );
    }
    const folder = options.folder.replace(/[^a-z0-9_-]/gi, '');
    const key = `${folder}/${randomBytes(12).toString('hex')}.${ext}`;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: options.mime,
        }),
      );
    } catch (error) {
      this.logger.error('Echec de l upload S3', error);
      throw new ServiceUnavailableException('Stockage indisponible (S3).');
    }
    return { url: `${this.publicBaseUrl}/${key}` };
  }

  async delete(url: string): Promise<void> {
    const prefix = `${this.publicBaseUrl}/`;
    if (!url.startsWith(prefix)) return;
    const key = url.slice(prefix.length);
    if (!key) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      // Suppression best-effort : on log sans bloquer l'appelant.
      this.logger.warn(`Suppression S3 ignorée (${key})`, error);
    }
  }
}
