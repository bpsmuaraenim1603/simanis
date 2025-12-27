import { NestFactory } from '@nestjs/core';
import { UsersModule } from './users.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(UsersModule);

  app.set('trust proxy', 1);
  
  app.enableCors({
    origin: '*',
    credentials: true,
  });
  
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views/email-templates'));
  app.setViewEngine('ejs');
  
  await app.listen(process.env.port ?? 4001);
}
bootstrap();
