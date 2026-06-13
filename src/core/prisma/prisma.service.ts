import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const CONNECT_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  /** Neon (serverless) peut mettre quelques secondes à réveiller le compute : on retente. */
  async onModuleInit(): Promise<void> {
    for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt++) {
      try {
        await this.$connect();
        return;
      } catch (error) {
        if (attempt === CONNECT_ATTEMPTS) throw error;
        this.logger.warn(
          `Connexion DB échouée (tentative ${attempt}/${CONNECT_ATTEMPTS}), nouvel essai dans ${RETRY_DELAY_MS} ms…`,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
