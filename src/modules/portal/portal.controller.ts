import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { LoginDto } from '../auth/dto/login.dto';
import { PortalService } from './portal.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';

@ApiTags('Portal')
@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Employee portal login' })
  login(@Body() dto: LoginDto) {
    return this.portalService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'Portal home greeting and quick links' })
  me(
    @CurrentUser('id') userId: string,
    @CurrentWorkspace('id') workspaceId: string,
  ) {
    return this.portalService.getMe(userId, workspaceId);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'Employee profile' })
  profile(
    @CurrentUser('id') userId: string,
    @CurrentWorkspace('id') workspaceId: string,
  ) {
    return this.portalService.getProfile(userId, workspaceId);
  }

  @Post('time-entries/clock-in')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'Clock in' })
  clockIn(
    @CurrentUser('id') userId: string,
    @CurrentWorkspace('id') workspaceId: string,
  ) {
    return this.portalService.clockIn(userId, workspaceId);
  }

  @Post('time-entries/clock-out')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'Clock out' })
  clockOut(
    @CurrentUser('id') userId: string,
    @CurrentWorkspace('id') workspaceId: string,
  ) {
    return this.portalService.clockOut(userId, workspaceId);
  }

  @Get('time-entries/today')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: "Today's clock status" })
  today(
    @CurrentUser('id') userId: string,
    @CurrentWorkspace('id') workspaceId: string,
  ) {
    return this.portalService.getToday(userId, workspaceId);
  }

  @Post('leave-requests')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'Submit a leave request' })
  createLeave(
    @CurrentUser('id') userId: string,
    @CurrentWorkspace('id') workspaceId: string,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.portalService.createLeaveRequest(userId, workspaceId, dto);
  }

  @Get('payslips')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'List payslips' })
  payslips(
    @CurrentUser('id') userId: string,
    @CurrentWorkspace('id') workspaceId: string,
  ) {
    return this.portalService.listPayslips(userId, workspaceId);
  }

  @Get('payslips/:id/download')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'Get payslip download URL' })
  downloadPayslip(
    @CurrentUser('id') userId: string,
    @CurrentWorkspace('id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.portalService.getPayslipDownload(userId, workspaceId, id);
  }
}
