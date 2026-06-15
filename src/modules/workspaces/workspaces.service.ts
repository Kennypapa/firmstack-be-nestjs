import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  ActivityType,
  MemberStatus,
  PlanId,
  WorkspaceMemberRole,
  WorkspaceType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId, status: MemberStatus.ACTIVE },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      type: membership.workspace.type,
      planId: membership.workspace.planId,
      currency: membership.workspace.currency,
      role: membership.role,
    }));
  }

  async getSettings(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });

    return {
      companyName: workspace.name,
      companyEmail: workspace.companyEmail,
      currency: workspace.currency,
      timezone: workspace.timezone,
    };
  }

  async updateSettings(workspaceId: string, dto: UpdateSettingsDto) {
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: dto.companyName,
        companyEmail: dto.companyEmail,
        currency: dto.currency,
        timezone: dto.timezone,
      },
    });

    return {
      companyName: workspace.name,
      companyEmail: workspace.companyEmail,
      currency: workspace.currency,
      timezone: workspace.timezone,
    };
  }

  async getNotifications(workspaceId: string) {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { workspaceId },
    });

    if (existing) {
      return this.toNotificationResponse(existing);
    }

    const created = await this.prisma.notificationPreference.create({
      data: { workspaceId },
    });

    return this.toNotificationResponse(created);
  }

  async updateNotifications(
    workspaceId: string,
    dto: UpdateNotificationsDto,
  ) {
    const updated = await this.prisma.notificationPreference.upsert({
      where: { workspaceId },
      create: { workspaceId, ...dto },
      update: { ...dto },
    });

    return this.toNotificationResponse(updated);
  }

  async completeOnboarding(
    workspaceId: string,
    userId: string,
    dto: CompleteOnboardingDto,
  ) {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });

    if (workspace.type !== WorkspaceType.COMPANY) {
      throw new ForbiddenException(
        'Onboarding is only available for company workspaces',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          industry: dto.industry,
          size: dto.size,
          planId: dto.planId,
        },
      });

      if (dto.employee) {
        const email = dto.employee.email.toLowerCase();
        const role =
          dto.employee.role === 'Admin'
            ? WorkspaceMemberRole.ADMIN
            : WorkspaceMemberRole.MEMBER;

        const existingUser = await tx.user.findUnique({ where: { email } });

        if (existingUser) {
          const alreadyMember = await tx.workspaceMember.findUnique({
            where: {
              workspaceId_userId: {
                workspaceId,
                userId: existingUser.id,
              },
            },
          });

          if (alreadyMember) {
            throw new ConflictException(
              'This person is already a member of the workspace',
            );
          }

          await tx.workspaceMember.create({
            data: {
              workspaceId,
              userId: existingUser.id,
              role,
              status: MemberStatus.PENDING,
            },
          });
        } else {
          const invitedUser = await tx.user.create({
            data: {
              email,
              passwordHash: '',
              firstName: dto.employee.name,
            },
          });

          await tx.workspaceMember.create({
            data: {
              workspaceId,
              userId: invitedUser.id,
              role,
              status: MemberStatus.PENDING,
            },
          });
        }
      }

      await tx.activityLog.create({
        data: {
          workspaceId,
          userId,
          action: 'Completed workspace onboarding',
          type: ActivityType.SETTINGS,
        },
      });

      return {
        id: updated.id,
        name: updated.name,
        planId: updated.planId as PlanId,
        nextStep: 'dashboard',
      };
    });
  }

  private toNotificationResponse(pref: {
    emailInvoice: boolean;
    emailExpense: boolean;
    emailTeam: boolean;
    emailWeekly: boolean;
  }) {
    return {
      emailInvoice: pref.emailInvoice,
      emailExpense: pref.emailExpense,
      emailTeam: pref.emailTeam,
      emailWeekly: pref.emailWeekly,
    };
  }
}
