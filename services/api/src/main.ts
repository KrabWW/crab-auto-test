import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ValidationPipe, Logger } from "@nestjs/common";
import fastifyMultipart from "@fastify/multipart";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );

  // Register multipart for file uploads (requirement documents, etc.).
  // 10MB limit covers typical PRD/Confluence PDF exports.
  // Cast bypasses a fastify 4.28 vs 4.29 type skew in @fastify/multipart 8.3;
  // runtime works correctly on 4.28.
  await app.register(fastifyMultipart as never, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3001")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins });

  app.setGlobalPrefix("api/v1", { exclude: ["health"] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";
  await app.listen(port, host);
  Logger.log(`🦀 crab-api listening on http://${host}:${port}/api/v1`, "Bootstrap");
}

bootstrap();
