import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { LoginDto } from '../auth/dto/login.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  login(dto: LoginDto) {
    return this.authService.login(dto);
  }

  async getMe(userId: string, workspaceId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { workspace: true },
    });

    const name =
      [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

    return {
      greeting: `Hello, ${user.firstName ?? name}`,
      links: [
        { label: 'Clock in/out', path: '/portal/clock' },
        { label: 'Leave requests', path: '/portal/leave' },
        { label: 'Payslips', path: '/portal/payslips' },
        { label: 'Profile', path: '/portal/profile' },
      ],
      workspace: membership?.workspace.name,
    };
  }

  async getProfile(userId: string, workspaceId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: { workspace: true },
    });

    return {
      fullName:
        [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
      email: user.email,
      department: membership?.workspace.industry ?? '',
      role: membership?.role.toLowerCase() ?? 'member',
    };
  }

  async clockIn(userId: string, workspaceId: string) {
    const open = await this.prisma.timeEntry.findFirst({
      where: { userId, workspaceId, clockOut: null },
    });

    if (open) {
      throw new ConflictException('You are already clocked in');
    }

    const entry = await this.prisma.timeEntry.create({
      data: {
        userId,
        workspaceId,
        clockIn: new Date(),
      },
    });

    return {
      clockedIn: true,
      clockInTime: entry.clockIn.toISOString(),
    };
  }

  async clockOut(userId: string, workspaceId: string) {
    const open = await this.prisma.timeEntry.findFirst({
      where: { userId, workspaceId, clockOut: null },
      orderBy: { clockIn: 'desc' },
    });

    if (!open) {
      throw new BadRequestException('You are not clocked in');
    }

    const entry = await this.prisma.timeEntry.update({
      where: { id: open.id },
      data: { clockOut: new Date() },
    });

    return {
      clockedIn: false,
      clockInTime: entry.clockIn.toISOString(),
      clockOutTime: entry.clockOut?.toISOString(),
    };
  }

  async getToday(userId: string, workspaceId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const open = await this.prisma.timeEntry.findFirst({
      where: {
        userId,
        workspaceId,
        clockOut: null,
        clockIn: { gte: start, lte: end },
      },
      orderBy: { clockIn: 'desc' },
    });

    if (open) {
      return {
        clockedIn: true,
        clockInTime: open.clockIn.toISOString(),
      };
    }

    const last = await this.prisma.timeEntry.findFirst({
      where: {
        userId,
        workspaceId,
        clockIn: { gte: start, lte: end },
      },
      orderBy: { clockIn: 'desc' },
    });

    return {
      clockedIn: false,
      clockInTime: last?.clockIn.toISOString(),
      clockOutTime: last?.clockOut?.toISOString(),
    };
  }

  async createLeaveRequest(
    userId: string,
    workspaceId: string,
    dto: CreateLeaveRequestDto,
  ) {
    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);

    if (toDate < fromDate) {
      throw new BadRequestException('toDate must be on or after fromDate');
    }

    const request = await this.prisma.leaveRequest.create({
      data: {
        userId,
        workspaceId,
        leaveType: dto.leaveType,
        fromDate,
        toDate,
        reason: dto.reason,
      },
    });

    return {
      id: request.id,
      leaveType: request.leaveType.toLowerCase(),
      fromDate: request.fromDate.toISOString(),
      toDate: request.toDate.toISOString(),
      reason: request.reason,
    };
  }

  async listPayslips(userId: string, workspaceId: string) {
    const payslips = await this.prisma.payslip.findMany({
      where: { userId, workspaceId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    return payslips.map((slip) => ({
      id: slip.id,
      month: slip.month,
      year: slip.year,
      downloadUrl: slip.downloadUrl,
    }));
  }

  async getPayslipDownload(userId: string, workspaceId: string, id: string) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id, userId, workspaceId },
    });

    if (!payslip) {
      throw new NotFoundException('Payslip not found');
    }

    return {
      id: payslip.id,
      month: payslip.month,
      year: payslip.year,
      downloadUrl: payslip.downloadUrl,
    };
  }
}
