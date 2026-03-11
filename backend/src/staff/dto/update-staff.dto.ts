import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { StaffRole } from '@prisma/client';

export class UpdateStaffDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsEnum(StaffRole)
  @IsOptional()
  role?: StaffRole;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  serviceId?: string | null;
}

