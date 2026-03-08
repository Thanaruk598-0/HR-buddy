import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertRuntimeConfig } from './config/runtime-config.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);
  assertRuntimeConfig(config);
  app.enableCors({
    origin: config.get<string[]>('corsOrigins'),
    credentials: true,
  });

  await app.listen(config.get<number>('port') ?? 3001);
}
bootstrap();
