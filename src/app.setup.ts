import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { resolve } from 'node:path';
import { Env } from './core/config/env';

/**
 * Premier message de contrainte, en string : l'app Flutter affiche
 * directement `message` et ne sait pas rendre un tableau.
 */
function firstConstraintMessage(errors: ValidationError[]): string {
  for (const error of errors) {
    if (error.constraints) return Object.values(error.constraints)[0];
    if (error.children?.length) {
      const nested = firstConstraintMessage(error.children);
      if (nested) return nested;
    }
  }
  return 'Requête invalide.';
}

/** Configuration commune à main.ts et aux tests e2e (préfixe, pipes, CORS, statiques). */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException(firstConstraintMessage(errors)),
    }),
  );

  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({
    origin: corsOrigins === '*' ? true : corsOrigins.split(','),
  });

  // Fichiers uploadés en dev — hors préfixe /v1, URLs absolues comme Cloudinary.
  app.useStaticAssets(resolve(config.get('UPLOAD_DIR', { infer: true })), {
    prefix: '/uploads/',
  });
}

export function setupSwagger(app: NestExpressApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('DJOSSI API')
    .setDescription(
      'Backend de l’app DJOSSI — les talents de ton quartier. ' +
        'Auth par OTP SMS + JWT. Toutes les réponses sont en snake_case.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );
}
