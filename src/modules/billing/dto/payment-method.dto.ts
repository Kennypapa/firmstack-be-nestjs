import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PaymentMethodDto {
  @ApiPropertyOptional({ example: 'card' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: '4242' })
  @IsOptional()
  @IsString()
  last4?: string;
}
