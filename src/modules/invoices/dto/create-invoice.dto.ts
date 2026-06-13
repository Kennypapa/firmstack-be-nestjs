import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class InvoicePartyDto {
  @ApiProperty({ example: 'Globex Corporation' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'accounts@globex.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '123 Business Ave, Lagos' })
  @IsOptional()
  @IsString()
  address?: string;
}

export class InvoiceLineItemDto {
  @ApiProperty({ example: 'Consulting services' })
  @IsString()
  description!: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty({ example: 150 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateInvoiceDto {
  @ApiProperty({
    type: InvoicePartyDto,
    example: {
      name: 'Globex Corporation',
      email: 'accounts@globex.com',
      address: '123 Business Ave, Lagos',
    },
  })
  @ValidateNested()
  @Type(() => InvoicePartyDto)
  client!: InvoicePartyDto;

  @ApiProperty({
    type: InvoicePartyDto,
    example: {
      name: 'Acme Inc',
      email: 'billing@acme.com',
    },
  })
  @ValidateNested()
  @Type(() => InvoicePartyDto)
  from!: InvoicePartyDto;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  invoiceDate!: string;

  @ApiProperty({ example: '2026-06-15' })
  @IsDateString()
  dueDate!: string;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  @IsEnum(Currency)
  currency!: Currency;

  @ApiProperty({
    type: [InvoiceLineItemDto],
    example: [
      { description: 'Consulting services', quantity: 10, unitPrice: 150 },
      { description: 'Project setup', quantity: 1, unitPrice: 500 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems!: InvoiceLineItemDto[];

  @ApiPropertyOptional({ example: 7.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxPercent?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ example: 'Payment due within 14 days. Thank you!' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'When true, the invoice is sent and marked Pending',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  send?: boolean;
}
