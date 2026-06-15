import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
  Prisma,
  WorkspaceMemberRole,
  WorkspaceType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, RegisterWorkspaceType } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const SALT_ROUNDS = 12;
const SESSION_DAYS = 7;
const RESET_TOKEN_HOURS = 1;
const VERIFY_TOKEN_HOURS = 24;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const isCompany = dto.workspaceType === RegisterWorkspaceType.COMPANY;
    const workspaceName = isCompany
      ? (dto.companyName as string)
      : 'Personal Workspace';

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName ?? null,
          lastName: dto.lastName ?? null,
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          type: isCompany ? WorkspaceType.COMPANY : WorkspaceType.PERSONAL,
          name: workspaceName,
          ownerId: createdUser.id,
          companyEmail: isCompany ? createdUser.email : null,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: createdUser.id,
          role: WorkspaceMemberRole.OWNER,
          status: 'ACTIVE',
        },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: createdUser.id,
          token: this.generateToken(),
          expiresAt: this.hoursFromNow(VERIFY_TOKEN_HOURS),
        },
      });

      return createdUser;
    });

    const { accessToken } = await this.issueToken(user.id, user.email);

    return {
      accessToken,
      user: this.toUserResponse(user),
      nextStep: isCompany ? 'onboarding' : 'dashboard',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const expiresInDays = dto.rememberMe ? 30 : SESSION_DAYS;
    const { accessToken } = await this.issueToken(user.id, user.email, expiresInDays);

    return {
      accessToken,
      user: this.toUserResponse(user),
    };
  }

  async logout(sessionId?: string) {
    if (sessionId) {
      await this.prisma.session.deleteMany({ where: { id: sessionId } });
    }

    return { message: 'Logged out successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException();
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);

    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.prisma.session.deleteMany({ where: { userId } });

    return { message: 'Password updated successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (user) {
      await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: this.generateToken(),
          expiresAt: this.hoursFromNow(RESET_TOKEN_HOURS),
        },
      });
    }

    return {
      message: 'If an account exists for that email, a reset link has been sent',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.delete({ where: { id: record.id } }),
      this.prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    return { message: 'Password reset successfully' };
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      }),
      this.prisma.emailVerificationToken.delete({ where: { id: record.id } }),
    ]);

    return { message: 'Email verified successfully' };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    await this.prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        token: this.generateToken(),
        expiresAt: this.hoursFromNow(VERIFY_TOKEN_HOURS),
      },
    });

    return { message: 'Verification email sent' };
  }

  async listSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const result = await this.prisma.session.deleteMany({
      where: { id: sessionId, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Session not found');
    }

    return { id: sessionId, revoked: true };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            workspace: {
              select: { id: true, name: true, type: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      ...this.toUserResponse(user),
      workspaces: user.memberships.map((membership) => ({
        id: membership.workspace.id,
        name: membership.workspace.name,
        type: membership.workspace.type,
        role: membership.role,
      })),
    };
  }

  async validateSession(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    return !!session && session.expiresAt > new Date();
  }

  private async issueToken(userId: string, email: string, days = SESSION_DAYS) {
    const sessionToken = this.generateToken();
    const expiresAt = this.daysFromNow(days);

    const session = await this.prisma.session.create({
      data: {
        userId,
        token: sessionToken,
        expiresAt,
      },
    });

    const accessToken = this.jwtService.sign(
      { sub: userId, email, sid: session.id },
      { expiresIn: `${days}d` as `${number}d` },
    );

    return { accessToken, sessionId: session.id };
  }

  private generateToken() {
    return randomBytes(32).toString('hex');
  }

  private hoursFromNow(hours: number) {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private daysFromNow(days: number) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private toUserResponse(
    user: Prisma.UserGetPayload<Record<string, never>>,
  ) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
    };
  }
}
