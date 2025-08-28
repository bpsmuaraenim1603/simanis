import { Module } from '@nestjs/common';
import { SurveyActivityService } from './surveyacts.service';
import { SurveyActivityResolver } from './surveyact.resolver';
import { PrismaService } from '../../../prisma/prisma.service';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';
import { HttpModule } from '@nestjs/axios';
import { FilesModule } from './files/files.module';

@Module({
  imports: [
    FilesModule,
    HttpModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        federation: 2,
      },
      context: ({ req }) => ({ req }),
    }),
  ],
  providers: [SurveyActivityService, SurveyActivityResolver, PrismaService],
})
export class SurveyActModule {}
