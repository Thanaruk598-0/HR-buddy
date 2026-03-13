import { IsIn, IsOptional } from 'class-validator';

export type AttachmentDownloadMode = 'download' | 'inline';

export class AttachmentDownloadUrlQueryDto {
  @IsOptional()
  @IsIn(['download', 'inline'])
  mode?: AttachmentDownloadMode;
}
