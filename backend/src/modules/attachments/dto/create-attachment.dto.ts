import { FileKind } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAttachmentDto {
  @IsEnum(FileKind)
  fileKind!: FileKind;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(104857600)
  fileSize!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  storageKey!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(1000)
  publicUrl?: string;
}