import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Env } from '../core/config/env';
import { RealtimeGateway } from './realtime.gateway';
import { WsJwtGuard } from './ws-jwt.guard';

/**
 * Fondation temps réel : passerelle Socket.IO + garde JWT.
 *
 * Le `JwtModule` est (ré)enregistré ici avec le MÊME secret et la MÊME durée
 * d'accès que l'auth HTTP (cf. AuthModule), pour que `WsJwtGuard` vérifie les
 * access tokens existants sans dépendance circulaire vers AuthModule.
 * `PrismaService` est disponible globalement (PrismaModule @Global) si besoin.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_ACCESS_TTL', { infer: true }),
        },
      }),
    }),
  ],
  providers: [RealtimeGateway, WsJwtGuard],
  exports: [WsJwtGuard],
})
export class RealtimeModule {}
