import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { WorkspaceMemberRole, WorkspaceType } from '@prisma/client';

export interface ActiveWorkspace {
  id: string;
  role: WorkspaceMemberRole;
  type: WorkspaceType;
}

export const CurrentWorkspace = createParamDecorator(
  (data: keyof ActiveWorkspace | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{
      workspace: ActiveWorkspace;
    }>();
    return data ? request.workspace?.[data] : request.workspace;
  },
);
