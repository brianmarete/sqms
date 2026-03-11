import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateServiceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  counterLabel?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

