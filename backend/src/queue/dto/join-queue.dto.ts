import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class JoinQueueDto {
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  serviceType: string;

  @IsString()
  @IsNotEmpty()
  branchId: string;
}
