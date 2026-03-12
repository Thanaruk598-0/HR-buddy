import { BuildingSide, Urgency } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBuildingRequestDto {
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

  @IsEnum(BuildingSide)
  building!: BuildingSide;

  @IsInt()
  @Min(1)
  @Max(4)
  floor!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  locationDetail!: string;

  @IsString()
  @IsNotEmpty()
  problemCategoryId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  problemCategoryOther?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  additionalDetails?: string;
}
