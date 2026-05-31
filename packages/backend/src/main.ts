import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { buildOpenApiDocument, createApp } from './app.factory';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app));

  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: '0.0.0.0' });
  new Logger('Bootstrap').log(`Listening on http://localhost:${port} — docs at /docs`);
}

void bootstrap();
