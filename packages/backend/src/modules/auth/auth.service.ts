import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Env } from '../../config/env';

const BCRYPT_ROUNDS = 10;

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Password hashing and JWT sign/verify. The single source of JWT logic — the
 * JwtAuthGuard delegates token verification here (architecture §5/§8).
 */
@Injectable()
export class AuthService {
  private readonly secret: string;
  private readonly expiration: string;

  constructor(config: ConfigService<Env, true>) {
    this.secret = config.get('JWT_SECRET', { infer: true }) ?? 'dev-secret-change-me';
    this.expiration = config.get('JWT_EXPIRATION', { infer: true });
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  signToken(payload: { sub: string; email: string }): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiration,
    } as jwt.SignOptions);
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, this.secret) as JwtPayload;
  }
}
