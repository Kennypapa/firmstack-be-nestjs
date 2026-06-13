import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export enum InvoiceStatusFilter {
  All = 'All',
  Paid = 'Paid',
  Pending = 'Pending',
  Overdue = 'Overdue',
  Draft = 'Draft',
}

export class QueryInvoicesDto {
  @ApiPropertyOptional({ description: 'Search by client name or invoice number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: InvoiceStatusFilter })
  @IsOptional()
  @IsEnum(InvoiceStatusFilter)
  status?: InvoiceStatusFilter;

  @ApiPropertyOptional({ description: 'Filter by due date from (ISO)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter by due date to (ISO)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
