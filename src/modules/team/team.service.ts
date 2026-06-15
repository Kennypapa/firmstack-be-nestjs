import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  MemberStatus,
  PlanId,
  Prisma,
  WorkspaceMemberRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InviteMemberDto, InviteRole } from './dto/invite-member.dto';

const PLAN_MEMBER_LIMITS: Record<PlanId, number> = {
  [PlanId.FREE]: 3,
  [PlanId.PRO]: Number.POSITIVE_INFINITY,
  [PlanId.ENTERPRISE]: Number.POSITIVE_INFINITY,
};

const memberInclude = {
  user: {
    select: { firstName: true, lastName: true, email: true, avatarUrl: true },
  },
} satisfies Prisma.WorkspaceMemberInclude;

type MemberWithUser = Prisma.WorkspaceMemberGetPayload<{
  include: typeof memberInclude;
}>;

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  async list(workspaceId: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: memberInclude,
      orderBy: { createdAt: 'asc' },
    });

    return members.map((member) => this.toResponse(member));
  }

  async invite(workspaceId: string, userId: string, dto: InviteMemberDto) {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });

    const memberCount = await this.prisma.workspaceMember.count({
      where: { workspaceId },
    });

    if (memberCount >= PLAN_MEMBER_LIMITS[workspace.planId]) {
      throw new ForbiddenException(
        `Your ${workspace.planId.toLowerCase()} plan is limited to ${PLAN_MEMBER_LIMITS[workspace.planId]} members. Upgrade to add more.`,
      );
    }

    const email = dto.email.toLowerCase();
    const role =
      dto.role === InviteRole.Admin
        ? WorkspaceMemberRole.ADMIN
        : WorkspaceMemberRole.MEMBER;

    const member = await this.prisma.$transaction(async (tx) => {
      let invitedUser = await tx.user.findUnique({ where: { email } });

      if (!invitedUser) {
        invitedUser = await tx.user.create({
          data: { email, passwordHash: '' },
        });
      }

      const existingMembership = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: invitedUser.id },
        },
      });

      if (existingMembership) {
        throw new ConflictException(
          'This person is already part of the workspace',
        );
      }

      const created = await tx.workspaceMember.create({
        data: {
          workspaceId,
          userId: invitedUser.id,
          role,
          status: MemberStatus.PENDING,
        },
        include: memberInclude,
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          userId,
          action: `Invited ${email} as ${dto.role}`,
          type: ActivityType.TEAM,
        },
      });

      return created;
    });

    return this.toResponse(member);
  }

  async updateRole(workspaceId: string, memberId: string, role: InviteRole) {
    const member = await this.getMemberOrThrow(workspaceId, memberId);

    if (member.role === WorkspaceMemberRole.OWNER) {
      throw new BadRequestException("The owner's role cannot be changed");
    }

    const updated = await this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: {
        role:
          role === InviteRole.Admin
            ? WorkspaceMemberRole.ADMIN
            : WorkspaceMemberRole.MEMBER,
      },
      include: memberInclude,
    });

    return this.toResponse(updated);
  }

  async resendInvite(workspaceId: string, memberId: string) {
    const member = await this.getMemberOrThrow(workspaceId, memberId);

    if (member.status !== MemberStatus.PENDING) {
      throw new BadRequestException('This member has already accepted');
    }

    return { id: memberId, resent: true };
  }

  async remove(workspaceId: string, memberId: string) {
    const member = await this.getMemberOrThrow(workspaceId, memberId);

    if (member.role === WorkspaceMemberRole.OWNER) {
      throw new BadRequestException('The owner cannot be removed');
    }

    await this.prisma.workspaceMember.delete({ where: { id: memberId } });

    return { id: memberId, removed: true };
  }

  private async getMemberOrThrow(workspaceId: string, memberId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    return member;
  }

  private toResponse(member: MemberWithUser) {
    const name =
      [member.user.firstName, member.user.lastName]
        .filter(Boolean)
        .join(' ') || member.user.email;

    const isOwner = member.role === WorkspaceMemberRole.OWNER;

    return {
      id: member.id,
      name,
      email: member.user.email,
      role: isOwner ? 'Admin' : this.toRoleLabel(member.role),
      status: member.status === MemberStatus.ACTIVE ? 'Active' : 'Pending',
      addedOn: member.createdAt.toISOString(),
      avatar: member.user.avatarUrl,
      isOwner,
    };
  }

  private toRoleLabel(role: WorkspaceMemberRole) {
    return role === WorkspaceMemberRole.ADMIN ? 'Admin' : 'Member';
  }
}
