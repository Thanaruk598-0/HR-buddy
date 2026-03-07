import { FileKind } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAttachmentUploadTicketDto {
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
}
