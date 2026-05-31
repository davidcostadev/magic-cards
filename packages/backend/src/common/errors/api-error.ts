import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Stripe-style error type. There is deliberately no `permission_error`: cross-user
 * access returns 404 (don't leak existence), so 403 is never emitted (architecture §6).
 */
export type ApiErrorType = 'invalid_request_error' | 'authentication_error' | 'api_error';

export function errorTypeForStatus(status: number): ApiErrorType {
  if (status === HttpStatus.UNAUTHORIZED) return 'authentication_error';
  if (status >= 400 && status < 500) return 'invalid_request_error';
  return 'api_error';
}

/**
 * Domain error carrying an i18n `code` (never user-facing text) and an optional
 * offending `param`. The global HttpExceptionFilter renders it as the Stripe envelope.
 */
export class ApiError extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: string,
    public readonly param?: string
  ) {
    super({ code, param }, status);
  }

  static badRequest(code: string, param?: string): ApiError {
    return new ApiError(HttpStatus.BAD_REQUEST, code, param);
  }

  static unauthorized(code: string): ApiError {
    return new ApiError(HttpStatus.UNAUTHORIZED, code);
  }

  static notFound(code: string): ApiError {
    return new ApiError(HttpStatus.NOT_FOUND, code);
  }
}
