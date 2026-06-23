import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({ origin: [process.env.FRONTEND_URL ?? 'http://localhost:3000', 'http://localhost:3001'] })
  app.setGlobalPrefix('api/v1')

  const config = new DocumentBuilder()
    .setTitle('BoardGame Navigator API')
    .setDescription('보드게임 AI 검색엔진 API')
    .setVersion('1.0')
    .build()
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config))

  await app.listen(process.env.PORT ?? 4000)
}

bootstrap()
