import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { map, type Observable } from 'rxjs';

/**
 * Marker a controller returns to opt into the Stripe list envelope. Only these are
 * wrapped, so single-resource responses pass through untouched.
 */
export class ListResponse<T> {
  constructor(
    public readonly data: T[],
    public readonly hasMore = false
  ) {}
}

interface ListEnvelope<T> {
  object: 'list';
  url: string;
  has_more: boolean;
  data: T[];
}

/** Wraps `ListResponse` results as `{ object: 'list', url, has_more, data }` (architecture §6). */
@Injectable()
export class ListInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    return next.handle().pipe(
      map((payload) => {
        if (!(payload instanceof ListResponse)) return payload;
        const envelope: ListEnvelope<unknown> = {
          object: 'list',
          url: request.url.split('?')[0],
          has_more: payload.hasMore,
          data: payload.data,
        };
        return envelope;
      })
    );
  }
}
