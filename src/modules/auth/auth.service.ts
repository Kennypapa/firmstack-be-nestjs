import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  Prisma,
  WorkspaceMemberRole,
  WorkspaceType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, RegisterWorkspaceType } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 12;

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

      return createdUser;
    });

    const token = this.signToken(user.id, user.email);

    return {
      accessToken: token,
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

    const token = this.signToken(user.id, user.email);

    return {
      accessToken: token,
      user: this.toUserResponse(user),
    };
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

  private signToken(userId: string, email: string) {
    return this.jwtService.sign({ sub: userId, email });
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
