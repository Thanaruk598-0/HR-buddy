import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AnonymizeRequestDto {
  @IsString()
  @IsNotEmpty()
  operatorId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
