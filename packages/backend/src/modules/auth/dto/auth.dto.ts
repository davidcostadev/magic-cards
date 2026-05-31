import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { User } from '../../../db/schema';

export const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(100),
  username: z.string().min(1).max(50),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const updateMeSchema = z
  .object({
    language: z.string().min(2).max(10),
    theme: z.enum(['light', 'dark']),
    dailyGoal: z.number().int().min(1).max(500),
  })
  .partial();

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  language: z.string(),
  theme: z.string(),
  dailyGoal: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const authResponseSchema = z.object({
  user: userResponseSchema,
  token: z.string(),
});

export class SignupDto extends createZodDto(signupSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class UpdateMeDto extends createZodDto(updateMeSchema) {}
export class UserResponseDto extends createZodDto(userResponseSchema) {}
export class AuthResponseDto extends createZodDto(authResponseSchema) {}

export type UserResponse = z.infer<typeof userResponseSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;

/** Strip the password hash; the DB row is already in camelCase. */
export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    language: user.language,
    theme: user.theme,
    dailyGoal: user.dailyGoal,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
