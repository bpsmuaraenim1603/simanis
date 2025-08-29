import { NestFactory } from '@nestjs/core';
import { SurveyActModule } from './surveyact.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { graphqlUploadExpress } from 'graphql-upload-ts';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(SurveyActModule);

  app.enableCors({
    origin: '*', // Allow all origins, adjust as needed
    credentials: true, // Enable cookies and credentials if needed
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'content-type',
      'apollo-require-preflight',
      'x-apollo-operation-name',
      'accesstoken',
      'refreshtoken',
    ],
  });

  app.use(graphqlUploadExpress({ maxFileSize: 20 * 1024 * 1024, maxFiles: 1 })); // 20MB

  await app.listen(process.env.PORT ?? 4002);
}
bootstrap();
