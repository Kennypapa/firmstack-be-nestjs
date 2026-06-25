import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateLeaveRequestDto {
  @ApiProperty({ enum: LeaveType, example: LeaveType.ANNUAL })
  @IsEnum(LeaveType)
  leaveType!: LeaveType;

  @ApiProperty({ example: '2026-06-20' })
  @IsDateString()
  fromDate!: string;

  @ApiProperty({ example: '2026-06-22' })
  @IsDateString()
  toDate!: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  reason?: string;
}
