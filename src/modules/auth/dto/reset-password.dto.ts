import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).+$/;

export class ResetPasswordDto {
  @ApiProperty({ example: '' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: '' })
  @MinLength(8)
  @Matches(PASSWORD_PATTERN, {
    message:
      'Password must contain an uppercase letter, lowercase letter, digit, and special character (!@#$%^&*)',
  })
  password!: string;

  @ApiProperty({ example: '' })
  @MinLength(8)
  @Matches(PASSWORD_PATTERN, {
    message:
      'Password must contain an uppercase letter, lowercase letter, digit, and special character (!@#$%^&*)',
  })
  confirmPassword!: string;
}
