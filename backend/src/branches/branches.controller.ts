import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller()
export class BranchesController {
  constructor(private branches: BranchesService) {}

  // Public: used by kiosk to discover branches
  @Get('branches')
  listBranches() {
    return this.branches.list();
  }

  // Admin CRUD
  @Get('admin/branches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.ADMIN)
  adminListBranches() {
    return this.branches.list();
  }

  @Post('admin/branches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.ADMIN)
  createBranch(@Body() dto: CreateBranchDto) {
    return this.branches.create(dto);
  }

  @Patch('admin/branches/:branchId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.ADMIN)
  updateBranch(@Param('branchId') branchId: string, @Body() dto: UpdateBranchDto) {
    return this.branches.update(branchId, dto);
  }

  @Delete('admin/branches/:branchId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.ADMIN)
  deleteBranch(@Param('branchId') branchId: string) {
    return this.branches.remove(branchId);
  }
}

