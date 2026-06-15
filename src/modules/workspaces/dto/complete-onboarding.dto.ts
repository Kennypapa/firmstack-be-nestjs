import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanId } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OnboardingEmployeeDto {
  @ApiProperty({ example: 'Alex Johnson' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'alex@acme.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ['Admin', 'Member'], example: 'Member' })
  @IsEnum(['Admin', 'Member'])
  role!: 'Admin' | 'Member';
}

export class CompleteOnboardingDto {
  @ApiPropertyOptional({ example: 'Technology' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: '1-10' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiProperty({ enum: PlanId, example: PlanId.FREE })
  @IsEnum(PlanId)
  planId!: PlanId;

  @ApiPropertyOptional({ type: OnboardingEmployeeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingEmployeeDto)
  employee?: OnboardingEmployeeDto;
}
