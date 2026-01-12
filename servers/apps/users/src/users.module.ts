import { Module } from '@nestjs/common';
// import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { GraphQLModule } from '@nestjs/graphql';
import {
  ApolloFederationDriver,
  ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsersResolver } from './users.resolver';
import { EmailModule } from './email/email.module';
import { EmailService } from './email/email.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
import { GqlThrottlerGuard } from './guards/gql-throttler.guard';
import { AuthGuard } from './guards/auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        federation: 2,
      },
      context: ({ req, res }) => ({ req, res }),
      debug: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      playground: process.env.NODE_ENV !== 'production',
    }),
    EmailModule,
    CacheModule.register({
      ttl: 60,
      isGlobal: true,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 120,
        },
      ],
    }),
  ],
  controllers: [],
  providers: [
    UsersService,
    ConfigService,
    JwtService,
    PrismaService,
    UsersResolver,
    EmailService,
    { provide: APP_GUARD, useClass: GqlThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class UsersModule {}
