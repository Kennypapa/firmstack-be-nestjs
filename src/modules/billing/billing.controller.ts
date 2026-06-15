import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceMemberRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { BillingService } from './billing.service';
import { UpgradePlanDto } from './dto/upgrade-plan.dto';
import { PaymentMethodDto } from './dto/payment-method.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('billing')
  @ApiOperation({ summary: 'Get plan, usage limits, and payment method' })
  getBilling(@CurrentWorkspace('id') workspaceId: string) {
    return this.billingService.getBilling(workspaceId);
  }

  @Post('billing/upgrade')
  @ApiOperation({ summary: 'Upgrade workspace plan' })
  upgrade(
    @CurrentWorkspace('id') workspaceId: string,
    @Body() dto: UpgradePlanDto,
  ) {
    return this.billingService.upgrade(workspaceId, dto);
  }

  @Post('billing/payment-method')
  @ApiOperation({ summary: 'Add or update payment method' })
  updatePaymentMethod(
    @CurrentWorkspace('id') workspaceId: string,
    @Body() dto: PaymentMethodDto,
  ) {
    return this.billingService.updatePaymentMethod(workspaceId, dto);
  }

  @Delete('workspace')
  @Roles(WorkspaceMemberRole.OWNER)
  @ApiOperation({ summary: 'Delete workspace (owner only, danger zone)' })
  deleteWorkspace(
    @CurrentWorkspace('id') workspaceId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.billingService.deleteWorkspace(workspaceId, userId);
  }
}
