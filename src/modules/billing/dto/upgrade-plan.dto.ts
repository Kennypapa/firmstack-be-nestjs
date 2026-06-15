import { ApiProperty } from '@nestjs/swagger';
import { PlanId } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpgradePlanDto {
  @ApiProperty({ enum: PlanId, example: PlanId.PRO })
  @IsEnum(PlanId)
  planId!: PlanId;
}
