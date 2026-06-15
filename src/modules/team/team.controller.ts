import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { TeamService } from './team.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('Team')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @ApiOperation({ summary: 'List team members' })
  list(@CurrentWorkspace('id') workspaceId: string) {
    return this.teamService.list(workspaceId);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Invite a member by email and role' })
  invite(
    @CurrentWorkspace('id') workspaceId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.teamService.invite(workspaceId, userId, dto);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Change a member role between Admin and Member' })
  updateRole(
    @CurrentWorkspace('id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.teamService.updateRole(workspaceId, id, dto.role);
  }

  @Post(':id/resend-invite')
  @ApiOperation({ summary: 'Resend a pending invite' })
  resendInvite(
    @CurrentWorkspace('id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.teamService.resendInvite(workspaceId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a member (owner cannot be removed)' })
  remove(
    @CurrentWorkspace('id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.teamService.remove(workspaceId, id);
  }
}
