import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

export enum RegisterWorkspaceType {
  PERSONAL = 'personal',
  COMPANY = 'company',
}

const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).+$/;

export class RegisterDto {
  @ApiProperty({ enum: RegisterWorkspaceType })
  @IsEnum(RegisterWorkspaceType)
  workspaceType!: RegisterWorkspaceType;

  @ApiPropertyOptional({ description: 'Required when workspaceType is company' })
  @ValidateIf((dto: RegisterDto) => dto.workspaceType === RegisterWorkspaceType.COMPANY)
  @IsString()
  @IsNotEmpty()
  companyName?: string;

  @ApiProperty({ example: 'founder@acme.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description:
      'Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special (!@#$%^&*)',
  })
  @MinLength(8)
  @Matches(PASSWORD_PATTERN, {
    message:
      'Password must contain an uppercase letter, lowercase letter, digit, and special character (!@#$%^&*)',
  })
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty()
  @IsBoolean()
  agreedToTerms!: boolean;
}
