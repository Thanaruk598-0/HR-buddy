import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateOperatorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  displayName!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOperatorDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
