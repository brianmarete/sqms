import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  counterLabel?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

