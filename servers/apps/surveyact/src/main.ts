import { NestFactory } from '@nestjs/core';
import { SurveyActModule } from './surveyact.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { graphqlUploadExpress } from 'graphql-upload-ts';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(SurveyActModule);

  app.enableCors({
    origin: '*',
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'content-type',
      'apollo-require-preflight',
      'x-apollo-operation-name',
      'accesstoken',
      'refreshtoken',
    ],
  });

  app.use(graphqlUploadExpress({ maxFileSize: 10 * 1024 * 1024, maxFiles: 1 }));

  await app.listen(process.env.PORT ?? 4002);
}
bootstrap();
