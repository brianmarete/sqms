import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';

@Controller('admin/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(StaffRole.ADMIN)
export class StaffController {
  constructor(private staff: StaffService) {}

  @Get()
  list() {
    return this.staff.list();
  }

  @Get(':staffId')
  get(@Param('staffId') staffId: string) {
    return this.staff.get(staffId);
  }

  @Post()
  create(@Body() dto: CreateStaffDto) {
    return this.staff.create(dto);
  }

  @Patch(':staffId')
  update(@Param('staffId') staffId: string, @Body() dto: UpdateStaffDto) {
    return this.staff.update(staffId, dto);
  }

  @Delete(':staffId')
  remove(@Param('staffId') staffId: string) {
    return this.staff.remove(staffId);
  }
}

