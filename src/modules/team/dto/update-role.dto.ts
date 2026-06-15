import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { InviteRole } from './invite-member.dto';

export class UpdateRoleDto {
  @ApiProperty({ enum: InviteRole, example: InviteRole.Admin })
  @IsEnum(InviteRole)
  role!: InviteRole;
}
