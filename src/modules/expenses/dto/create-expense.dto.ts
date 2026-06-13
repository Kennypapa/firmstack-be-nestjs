import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategory } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: '2026-06-05' })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: ExpenseCategory, example: ExpenseCategory.SOFTWARE })
  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @ApiProperty({ example: 'GitHub team subscription' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 120 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 'https://cdn.firmstack.com/receipts/gh-120.pdf' })
  @IsOptional()
  @IsString()
  receiptUrl?: string;
}
