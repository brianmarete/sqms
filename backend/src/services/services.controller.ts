import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@Controller()
export class ServicesController {
  constructor(private services: ServicesService) {}

  // Public: kiosk can load services for a branch
  @Get('branches/:branchId/services')
  listBranchServices(
    @Param('branchId') branchId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.services.listForBranch(branchId, { activeOnly: activeOnly === 'true' });
  }

  // Admin CRUD
  @Post('admin/branches/:branchId/services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.ADMIN)
  createService(@Param('branchId') branchId: string, @Body() dto: CreateServiceDto) {
    return this.services.create(branchId, dto);
  }

  @Patch('admin/branches/:branchId/services/:serviceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.ADMIN)
  updateService(
    @Param('branchId') branchId: string,
    @Param('serviceId') serviceId: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.services.update(branchId, serviceId, dto);
  }

  @Delete('admin/branches/:branchId/services/:serviceId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.ADMIN)
  deleteService(@Param('branchId') branchId: string, @Param('serviceId') serviceId: string) {
    return this.services.remove(branchId, serviceId);
  }
}

