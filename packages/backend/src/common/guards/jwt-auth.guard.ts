import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
// Value imports: Nest resolves these constructor deps from emitted type metadata.
import { AuthService } from '../../modules/auth/auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ApiError } from '../errors/api-error';
import type { AuthUser } from '../types/authenticated-request';

/**
 * Global guard: every route requires a valid `Authorization: Bearer <JWT>` unless it
 * opts out with `@Public()`. On success, attaches `request.user` (architecture §5/§8).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: AuthUser }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthorized('auth.missingToken');
    }

    try {
      const payload = this.auth.verifyToken(header.slice('Bearer '.length));
      request.user = { id: payload.sub, email: payload.email };
      return true;
    } catch {
      throw ApiError.unauthorized('auth.invalidToken');
    }
  }
}
