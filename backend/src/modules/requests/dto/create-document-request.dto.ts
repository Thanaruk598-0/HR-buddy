import { DeliveryMethod, Urgency } from '@prisma/client';
import {
  IsDateString,
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  province!: string;

  @IsString()
  @IsNotEmpty()
  district!: string;

  @IsString()
  @IsNotEmpty()
  subdistrict!: string;

  @IsString()
  @IsNotEmpty()
  postalCode!: string;

  @IsString()
  @IsNotEmpty()
  houseNo!: string;

  @IsOptional()
  @IsString()
  soi?: string;

  @IsOptional()
  @IsString()
  road?: string;

  @IsOptional()
  @IsString()
  extra?: string;
}

export class CreateDocumentRequestDto {
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
  @IsNotEmpty()
  @MaxLength(20)
  phone!: string;

  @IsEnum(Urgency)
  urgency!: Urgency;

  // site เป็น text + autocomplete: เก็บ raw แล้ว normalize ใน backend
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  siteNameRaw!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  documentDescription!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  purpose!: string;

  @IsDateString()
  neededDate!: string;

  @IsEnum(DeliveryMethod)
  deliveryMethod!: DeliveryMethod;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  // POSTAL เท่านั้น
  @IsOptional()
  @IsDefined()
  @ValidateNested()
  @Type(() => AddressDto)
  deliveryAddress?: AddressDto;
}
