import type { FastifyRequest } from 'fastify';

export interface AuthUser {
  id: string;
  email: string;
}

export type AuthenticatedRequest = FastifyRequest & { user: AuthUser };
