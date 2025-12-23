import { Module } from '@nestjs/common';
import { SurveyActivityService } from './surveyacts.service';
import { SurveyActivityResolver, UserSampleResolver } from './surveyact.resolver';
import { PrismaService } from '../../../prisma/prisma.service';
import { GraphQLModule } from '@nestjs/graphql';
import {
  ApolloFederationDriver,
  ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { HttpModule } from '@nestjs/axios';
import { SubmitSPJResolver } from './submit-spj.resolver';
import { GraphQLUpload } from 'graphql-upload-ts';
import { JobLetterResolver } from './jobletter.resolver';
import { StorageService } from './storage.service';

@Module({
  imports: [
    HttpModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        federation: 2,
      },
      resolvers: { Upload: GraphQLUpload as any },
      csrfPrevention: false,
      debug: true,
      context: ({ req }) => ({ req }),
    }),
  ],
  providers: [
    SurveyActivityService,
    SubmitSPJResolver,
    JobLetterResolver,
    StorageService,
    SurveyActivityResolver,
    UserSampleResolver,
    PrismaService,
  ],
})
export class SurveyActModule {}
