import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { ApiError, type ApiErrorType, errorTypeForStatus } from '../errors/api-error';

interface ErrorEnvelope {
  error: { type: ApiErrorType; code: string; param?: string };
}

/** Default i18n codes for framework-thrown HTTP errors that don't carry their own. */
const DEFAULT_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'errors.badRequest',
  [HttpStatus.UNAUTHORIZED]: 'errors.unauthorized',
  [HttpStatus.NOT_FOUND]: 'errors.notFound',
};

/**
 * Renders every thrown error as the Stripe-style envelope
 * `{ error: { type, code, param? } }` where `code` is an i18n key (architecture §6).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const envelope = this.toEnvelope(exception);
    const status = this.statusFor(exception);

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    reply.status(status).send(envelope);
  }

  private statusFor(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private toEnvelope(exception: unknown): ErrorEnvelope {
    if (exception instanceof ApiError) {
      return {
        error: {
          type: errorTypeForStatus(exception.getStatus()),
          code: exception.code,
          ...(exception.param ? { param: exception.param } : {}),
        },
      };
    }

    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError();
      const firstIssue = zodError instanceof ZodError ? zodError.issues[0] : undefined;
      const param = firstIssue?.path.join('.') || undefined;
      return {
        error: {
          type: 'invalid_request_error',
          code: 'errors.validation',
          ...(param ? { param } : {}),
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        error: {
          type: errorTypeForStatus(status),
          code: this.codeFromHttpException(exception) ?? DEFAULT_CODES[status] ?? 'errors.internal',
        },
      };
    }

    return { error: { type: 'api_error', code: 'errors.internal' } };
  }

  /** Honour an i18n code passed as the HttpException message (e.g. `auth.invalidToken`). */
  private codeFromHttpException(exception: HttpException): string | undefined {
    const response = exception.getResponse();
    const message =
      typeof response === 'string'
        ? response
        : ((response as { message?: unknown }).message ?? undefined);
    if (typeof message === 'string' && /^[a-z][\w.]*$/.test(message)) return message;
    return undefined;
  }
}
