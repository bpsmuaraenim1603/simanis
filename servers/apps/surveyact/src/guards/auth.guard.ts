import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}


  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    let req: any;
    try {
      const gqlContext = GqlExecutionContext.create(context);
      req = gqlContext.getContext()?.req;
    } catch {
      req = null;
    }

    if (!req) {
      req = context.switchToHttp().getRequest();
    }

    const accessToken = (req.headers?.accesstoken || req.headers?.accessToken) as string;
    const refreshToken = (req.headers?.refreshtoken || req.headers?.refreshToken) as string;

    if (!accessToken || !refreshToken) {
      throw new UnauthorizedException('Tolong login terlebih dahulu!');
    }

    try {
      const decoded = this.jwtService.verify(accessToken, {
        secret: this.config.get<string>('ACCESS_TOKEN_SECRET'),
      });
      req.user = decoded;
      return true;
    } catch {
      throw new UnauthorizedException('Token tidak valid!');
    }
  }
}