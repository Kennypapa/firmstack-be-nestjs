import { SetMetadata } from '@nestjs/common';
import { WorkspaceMemberRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: WorkspaceMemberRole[]) =>
  SetMetadata(ROLES_KEY, roles);
