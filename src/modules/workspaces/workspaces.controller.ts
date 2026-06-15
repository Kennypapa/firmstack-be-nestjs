import {
  Body,
  Controller,
  Get,
  Patch,
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
import { WorkspacesService } from './workspaces.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';

@ApiTags('Workspaces')
@ApiBearerAuth()
@Controller()
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get('workspaces')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List workspaces for the authenticated user' })
  list(@CurrentUser('id') userId: string) {
    return this.workspacesService.listForUser(userId);
  }

  @Post('onboarding/complete')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'Complete company onboarding and assign a plan' })
  completeOnboarding(
    @CurrentWorkspace('id') workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.workspacesService.completeOnboarding(workspaceId, userId, dto);
  }

  @Get('workspace/settings')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'Get workspace general settings' })
  getSettings(@CurrentWorkspace('id') workspaceId: string) {
    return this.workspacesService.getSettings(workspaceId);
  }

  @Patch('workspace/settings')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'Update workspace general settings' })
  updateSettings(
    @CurrentWorkspace('id') workspaceId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.workspacesService.updateSettings(workspaceId, dto);
  }

  @Get('workspace/notifications')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'Get notification preferences' })
  getNotifications(@CurrentWorkspace('id') workspaceId: string) {
    return this.workspacesService.getNotifications(workspaceId);
  }

  @Patch('workspace/notifications')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'Update notification preferences' })
  updateNotifications(
    @CurrentWorkspace('id') workspaceId: string,
    @Body() dto: UpdateNotificationsDto,
  ) {
    return this.workspacesService.updateNotifications(workspaceId, dto);
  }
}
