import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { parseOptionalBooleanQuery } from '../rules/query-transformers';

export class AdminSettingsListQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseOptionalBooleanQuery(value))
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
