import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';

export enum InviteRole {
  Admin = 'Admin',
  Member = 'Member',
}

export class InviteMemberDto {
  @ApiProperty({ example: 'alex@acme.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: InviteRole, example: InviteRole.Member })
  @IsEnum(InviteRole)
  role!: InviteRole;
}
