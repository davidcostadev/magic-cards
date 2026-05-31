import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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
  private readonly secret = process.env.JWT_SECRET ?? 'dev-secret-change-me';
  private readonly expiration = process.env.JWT_EXPIRATION ?? '24h';

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
