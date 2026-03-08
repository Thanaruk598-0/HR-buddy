import { NotificationEventType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { parseOptionalBooleanQuery } from '../utils/notification-query.util';

export class NotificationListQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseOptionalBooleanQuery(value))
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsEnum(NotificationEventType)
  eventType?: NotificationEventType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
