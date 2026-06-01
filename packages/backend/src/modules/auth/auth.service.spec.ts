import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import type { Env } from '../../config/env';
import { AuthService } from './auth.service';

const fakeConfig = {
  get: (key: keyof Env) => (key === 'JWT_EXPIRATION' ? '24h' : undefined),
} as unknown as ConfigService<Env, true>;

describe('AuthService', () => {
  const service = new AuthService(fakeConfig);

  it('hashes a password and verifies the round-trip', async () => {
    const hash = await service.hashPassword('s3cret-pw');
    expect(hash).not.toBe('s3cret-pw');
    expect(await service.verifyPassword('s3cret-pw', hash)).toBe(true);
    expect(await service.verifyPassword('wrong-pw', hash)).toBe(false);
  });

  it('signs a JWT carrying sub + email and verifies it', () => {
    const token = service.signToken({ sub: 'user-1', email: 'a@b.com' });
    const payload = service.verifyToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('a@b.com');
    expect(payload.exp).toBeGreaterThan(payload.iat ?? 0);
  });

  it('throws when verifying a malformed token', () => {
    expect(() => service.verifyToken('not-a-jwt')).toThrow();
  });
});
