import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { WorkspaceMemberRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Dashboard summary cards' })
  summary(@CurrentWorkspace('id') workspaceId: string) {
    return this.dashboardService.summary(workspaceId);
  }

  @Get('charts')
  @ApiQuery({ name: 'period', required: false, example: '6m' })
  @ApiOperation({ summary: 'Revenue vs expenses and profit trend charts' })
  charts(
    @CurrentWorkspace('id') workspaceId: string,
    @Query('period') period = '6m',
  ) {
    return this.dashboardService.charts(workspaceId, period);
  }

  @Get('activity')
  @ApiQuery({ name: 'limit', required: false, example: 5 })
  @ApiOperation({ summary: 'Recent workspace activity feed' })
  activity(
    @CurrentWorkspace('id') workspaceId: string,
    @Query('limit') limit = '5',
  ) {
    return this.dashboardService.activity(
      workspaceId,
      Math.min(parseInt(limit, 10) || 5, 50),
    );
  }
}
