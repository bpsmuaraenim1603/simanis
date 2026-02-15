import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    let req: any;
    try {
      req = GqlExecutionContext.create(context).getContext()?.req;
    } catch {
      req = context.switchToHttp().getRequest();
    }

    const decoded = req?.user;
    const userId = decoded?.id;

    if (!userId) throw new ForbiddenException('Akses ditolak');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { primaryRole: true, roles: true },
    });

    if (!user) throw new ForbiddenException('Akses ditolak');

    const roleList = [
      ...(user.primaryRole ? [user.primaryRole] : []),
      ...(Array.isArray(user.roles) ? user.roles : []),
    ];

    const ok = requiredRoles.some((r) => roleList.includes(r));
    if (!ok) throw new ForbiddenException('Akses ditolak');

    return true;
  }
}
