import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+?\d{9,15}$/)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  otpCode!: string;
}
