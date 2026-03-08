import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RequestStatus } from '@prisma/client';

export class MessengerStatusUpdateDto {
  @IsEnum(RequestStatus)
  status!: RequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
