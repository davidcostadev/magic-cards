import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { buildOpenApiDocument, createApp } from './app.factory';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  // ConfigModule validates env during create(); production requires JWT_SECRET + DATABASE_URL.
  const app = await createApp();
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app));

  const port = app.get(ConfigService<Env, true>).get('PORT', { infer: true });
  await app.listen({ port, host: '0.0.0.0' });
  new Logger('Bootstrap').log(`Listening on http://localhost:${port} — docs at /docs`);
}

void bootstrap();
