import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Env } from '../../core/config/env';
import { SaveFileOptions, StoragePort, StoredFile } from './storage.port';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class LocalDiskStorageAdapter extends StoragePort {
  private readonly uploadDir: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService<Env, true>) {
    super();
    this.uploadDir = resolve(config.get('UPLOAD_DIR', { infer: true }));
    this.publicBaseUrl = config
      .get('PUBLIC_BASE_URL', { infer: true })
      .replace(/\/$/, '');
  }

  async save(buffer: Buffer, options: SaveFileOptions): Promise<StoredFile> {
    const ext = EXT_BY_MIME[options.mime];
    if (!ext) {
      throw new BadRequestException(
        'Format de fichier non supporté (jpeg, png ou webp attendu).',
      );
    }
    const folder = options.folder.replace(/[^a-z0-9_-]/gi, '');
    const name = `${randomBytes(12).toString('hex')}.${ext}`;
    await mkdir(join(this.uploadDir, folder), { recursive: true });
    await writeFile(join(this.uploadDir, folder, name), buffer);
    return { url: `${this.publicBaseUrl}/uploads/${folder}/${name}` };
  }

  async delete(url: string): Promise<void> {
    const marker = '/uploads/';
    const index = url.indexOf(marker);
    if (index === -1) return;
    const relative = url
      .slice(index + marker.length)
      .replace(/\.\./g, '')
      .replace(/^\/+/, '');
    try {
      await unlink(join(this.uploadDir, relative));
    } catch {
      // Fichier déjà absent : rien à faire.
    }
  }
}
