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
import { AuthGuard } from './guards/auth.guard';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt/dist/jwt.service';
import { APP_GUARD } from '@nestjs/core/constants';
import { ScheduleModule } from '@nestjs/schedule';
import { TempDocCleanupService } from './temp-doc-cleanup.service';
import { SubSurveyStatusJob } from './jobs/subsurvey-status.job';
@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        federation: 2,
      },
      resolvers: { Upload: GraphQLUpload as any },
      csrfPrevention: false,
      context: ({ req, res }) => ({ req, res }),
      debug: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      playground: process.env.NODE_ENV !== 'production',
    }),
  ],
  controllers: [],
  providers: [
    SurveyActivityService,
    SubmitSPJResolver,
    JobLetterResolver,
    StorageService,
    SurveyActivityResolver,
    UserSampleResolver,
    PrismaService,
    ConfigService,
    JwtService,
    { provide: APP_GUARD, useClass: AuthGuard },
    TempDocCleanupService,
    SubSurveyStatusJob,
  ],
  exports: [],
})
export class SurveyActModule {}
