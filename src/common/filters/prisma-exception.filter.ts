import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/** Mappe les erreurs Prisma connues vers des réponses HTTP propres. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const httpException = this.toHttp(exception);
    response
      .status(httpException.getStatus())
      .json(httpException.getResponse());
  }

  private toHttp(e: Prisma.PrismaClientKnownRequestError): HttpException {
    switch (e.code) {
      case 'P2002':
        return new ConflictException('Cette ressource existe déjà.');
      case 'P2025':
        return new NotFoundException('Ressource introuvable.');
      case 'P2003':
        return new BadRequestException('Référence invalide.');
      default:
        return new InternalServerErrorException('Erreur interne.');
    }
  }
}
