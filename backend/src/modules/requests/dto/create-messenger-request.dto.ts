import { DeliveryService, ItemType, Urgency } from '@prisma/client';
import {
  IsBoolean,
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

export class CreateMessengerRequestDto {
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

  @IsDateString()
  pickupDatetime!: string;

  @IsEnum(ItemType)
  itemType!: ItemType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  itemDescription!: string;

  @IsBoolean()
  outsideBkkMetro!: boolean;

  @IsOptional()
  @IsEnum(DeliveryService)
  deliveryService?: DeliveryService;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deliveryServiceOther?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => AddressDto)
  sender!: AddressDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => AddressDto)
  receiver!: AddressDto;
}
