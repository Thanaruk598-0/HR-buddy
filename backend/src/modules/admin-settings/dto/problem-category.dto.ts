import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProblemCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  helperText?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProblemCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  helperText?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
