import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class JoinQueueDto {
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsOptional()
  @IsIn(['KIOSK', 'WEB', 'MOBILE'])
  channel?: 'KIOSK' | 'WEB' | 'MOBILE';
}
