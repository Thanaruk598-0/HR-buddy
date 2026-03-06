import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @Matches(/^\+?\d{9,15}$/)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email!: string;
}