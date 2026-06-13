import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { MemberStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { ActiveWorkspace } from '../decorators/current-workspace.decorator';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
      workspace?: ActiveWorkspace;
      headers: Record<string, string | undefined>;
    }>();

    const workspaceId = request.headers['x-workspace-id'];

    if (!workspaceId) {
      throw new BadRequestException('X-Workspace-Id header is required');
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: request.user.id },
      },
      include: { workspace: { select: { type: true } } },
    });

    if (!membership || membership.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    request.workspace = {
      id: workspaceId,
      role: membership.role,
      type: membership.workspace.type,
    };

    return true;
  }
}
