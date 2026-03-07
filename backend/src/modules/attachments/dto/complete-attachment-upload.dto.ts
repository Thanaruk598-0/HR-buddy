import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CompleteAttachmentUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  uploadToken!: string;
}
