import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlanId, WorkspaceMemberRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpgradePlanDto } from './dto/upgrade-plan.dto';
import { PaymentMethodDto } from './dto/payment-method.dto';

const PLAN_LIMITS: Record<
  PlanId,
  { teamMembers: number; invoicesThisMonth: number; storageMb: number }
> = {
  [PlanId.FREE]: { teamMembers: 3, invoicesThisMonth: 50, storageMb: 100 },
  [PlanId.PRO]: {
    teamMembers: Number.POSITIVE_INFINITY,
    invoicesThisMonth: Number.POSITIVE_INFINITY,
    storageMb: 5120,
  },
  [PlanId.ENTERPRISE]: {
    teamMembers: Number.POSITIVE_INFINITY,
    invoicesThisMonth: Number.POSITIVE_INFINITY,
    storageMb: Number.POSITIVE_INFINITY,
  },
};

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getBilling(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });

    const limits = PLAN_LIMITS[workspace.planId];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [teamMembers, invoicesThisMonth] = await Promise.all([
      this.prisma.workspaceMember.count({ where: { workspaceId } }),
      this.prisma.invoice.count({
        where: { workspaceId, createdAt: { gte: monthStart } },
      }),
    ]);

    return {
      plan: workspace.planId.toLowerCase(),
      usage: {
        teamMembers: { used: teamMembers, limit: this.formatLimit(limits.teamMembers) },
        invoicesThisMonth: {
          used: invoicesThisMonth,
          limit: this.formatLimit(limits.invoicesThisMonth),
        },
        storageMb: { used: 0, limit: this.formatLimit(limits.storageMb) },
      },
      paymentMethod: null as { type: string; last4?: string } | null,
    };
  }

  async upgrade(workspaceId: string, dto: UpgradePlanDto) {
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { planId: dto.planId },
    });

    return {
      plan: workspace.planId.toLowerCase(),
      message: `Plan upgraded to ${workspace.planId.toLowerCase()}`,
    };
  }

  async updatePaymentMethod(workspaceId: string, dto: PaymentMethodDto) {
    await this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });

    return {
      paymentMethod: {
        type: dto.type ?? 'card',
        last4: dto.last4,
      },
    };
  }

  async deleteWorkspace(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only the workspace owner can delete it');
    }

    await this.prisma.workspace.delete({ where: { id: workspaceId } });

    return { id: workspaceId, deleted: true };
  }

  private formatLimit(value: number) {
    return Number.isFinite(value) ? value : -1;
  }
}
