import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import type { Env } from './config/env';

/** Builds the Nest app on the Fastify adapter with the global `/v1` prefix + CORS. */
export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  const config = app.get(ConfigService<Env, true>);
  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();
  app.enableCors({
    origin: config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  });
  return app;
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Magic Cards API')
    .setDescription('Stripe-style REST API for the Magic Cards learning platform.')
    .setVersion('1.0.0')
    .addBearerAuth()
    // Catalog publish/delete endpoints authorize via a static API key, not the JWT.
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
    .build();
  // nestjs-zod DTOs self-describe via _OPENAPI_METADATA_FACTORY; cleanup emits valid 3.1.
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config), { version: '3.1' });
  document.openapi = '3.1.0';
  return document;
}
