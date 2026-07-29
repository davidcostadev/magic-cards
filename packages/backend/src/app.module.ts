import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ListInterceptor } from './common/interceptors/list.interceptor';
import { validateEnv } from './config/env';
import { DatabaseModule } from './db/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CardsModule } from './modules/cards/cards.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ProgressModule } from './modules/progress/progress.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SubjectsModule } from './modules/subjects/subjects.module';

@Module({
  imports: [
    // Validate env once at startup; fail fast on bad/missing config. Tests ignore the
    // .env file so they depend only on process.env (deterministic).
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    // Default rate limit: 300 requests / minute / IP (auth endpoints are stricter).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    DatabaseModule,
    AuthModule,
    SubjectsModule,
    CardsModule,
    ReviewsModule,
    DashboardModule,
    CatalogModule,
    ReportsModule,
    ProgressModule,
  ],
  providers: [
    // Validation first, then the global cross-cutting Stripe concerns.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ListInterceptor },
    // Rate limit before authenticating so public endpoints are protected too.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
