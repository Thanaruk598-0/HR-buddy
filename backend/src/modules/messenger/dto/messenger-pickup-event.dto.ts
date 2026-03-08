import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MessengerPickupEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
