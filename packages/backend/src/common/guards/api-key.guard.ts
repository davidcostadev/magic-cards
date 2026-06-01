import { timingSafeEqual } from 'node:crypto';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import type { Env } from '../../config/env';
import { ApiError } from '../errors/api-error';

/**
 * Guards the catalog publish endpoints with a static `x-api-key`. The catalog is
 * disabled (all requests denied) when `CONTENT_API_KEY` is unset.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get('CONTENT_API_KEY', { infer: true });
    if (!expected) throw ApiError.unauthorized('catalog.disabled');

    const provided = context.switchToHttp().getRequest<FastifyRequest>().headers['x-api-key'];
    if (typeof provided !== 'string' || !safeEqual(provided, expected)) {
      throw ApiError.unauthorized('catalog.invalidApiKey');
    }
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Length check first (timingSafeEqual requires equal lengths); the rest is constant-time.
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
