import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class MessengerProblemReportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note!: string;
}
