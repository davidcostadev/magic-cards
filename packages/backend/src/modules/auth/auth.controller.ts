import { Body, Controller, Get, HttpCode, Inject, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { eq } from 'drizzle-orm';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiError } from '../../common/errors/api-error';
import type { AuthUser } from '../../common/types/authenticated-request';
import { DRIZZLE, type DrizzleDB } from '../../db/client';
import { users } from '../../db/schema';
import { AuthService } from './auth.service';
import {
  type AuthResponse,
  AuthResponseDto,
  // Value imports: the ZodValidationPipe reads these DTO metatypes at runtime to validate.
  LoginDto,
  SignupDto,
  toUserResponse,
  UpdateMeDto,
  type UserResponse,
  UserResponseDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly auth: AuthService
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('auth/signup')
  @HttpCode(201)
  @ApiCreatedResponse({ type: AuthResponseDto })
  async signup(@Body() body: SignupDto): Promise<AuthResponse> {
    const [existing] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);
    if (existing) throw ApiError.badRequest('auth.emailAlreadyExists', 'email');

    const passwordHash = await this.auth.hashPassword(body.password);
    const [user] = await this.db
      .insert(users)
      .values({ email: body.email, passwordHash, username: body.username })
      .returning();

    const token = this.auth.signToken({ sub: user.id, email: user.email });
    return { user: toUserResponse(user), token };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('auth/login')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthResponseDto })
  async login(@Body() body: LoginDto): Promise<AuthResponse> {
    const [user] = await this.db.select().from(users).where(eq(users.email, body.email)).limit(1);
    if (!user) throw ApiError.unauthorized('auth.invalidCredentials');

    const valid = await this.auth.verifyPassword(body.password, user.passwordHash);
    if (!valid) throw ApiError.unauthorized('auth.invalidCredentials');

    const token = this.auth.signToken({ sub: user.id, email: user.email });
    return { user: toUserResponse(user), token };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponseDto })
  async me(@CurrentUser() current: AuthUser): Promise<UserResponse> {
    const [user] = await this.db.select().from(users).where(eq(users.id, current.id)).limit(1);
    if (!user) throw ApiError.unauthorized('auth.invalidToken');
    return toUserResponse(user);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UserResponseDto })
  async updateMe(
    @CurrentUser() current: AuthUser,
    @Body() body: UpdateMeDto
  ): Promise<UserResponse> {
    const [user] = await this.db
      .update(users)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(users.id, current.id))
      .returning();
    if (!user) throw ApiError.unauthorized('auth.invalidToken');
    return toUserResponse(user);
  }
}
