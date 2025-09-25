import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

const DEFAULT_PORT = 8080;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({
      json: true,
      colors: process.env.NODE_ENV === 'development',
    }),
  });
  app.set('trust proxy', true);
  app.enableCors();

  const config = app.get(ConfigService);
  const port = config.get<string>('PORT') || DEFAULT_PORT;

  await app.listen(port);
}

bootstrap().catch(console.error);
