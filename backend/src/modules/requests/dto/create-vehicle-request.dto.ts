import { Urgency } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateVehicleRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  employeeName!: string;

  @IsString()
  @IsNotEmpty()
  departmentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  departmentOther?: string;

  @IsString()
  @Matches(/^\+?\d{9,15}$/)
  phone!: string;

  @IsEnum(Urgency)
  urgency!: Urgency;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  vehiclePlate!: string;

  @IsString()
  @IsNotEmpty()
  issueCategoryId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  issueCategoryOther?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  symptom!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  additionalDetails?: string;
}
