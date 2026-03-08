import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { RequestStatus } from '@prisma/client';

export class AdminRequestActionDto {
  @IsEnum(RequestStatus)
  status!: RequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsString()
  @IsNotEmpty()
  operatorId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pickupNote?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  digitalFileAttachmentId?: string;
}
