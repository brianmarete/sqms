import { Controller, ForbiddenException, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StaffRole } from '@prisma/client';
import type { Request } from 'express';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('daily')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.STAFF, StaffRole.ADMIN)
  async getDailyStats(
    @Query('branchId') branchId: string,
    @Req() req: Request,
    @Query('date') date?: string,
  ) {
    const user = req.user as { role: StaffRole; branchId: string };
    if (user.role !== StaffRole.ADMIN && branchId !== user.branchId) {
      throw new ForbiddenException('You are not allowed to access this branch');
    }

    const targetDate = date ? new Date(date) : undefined;
    return this.analyticsService.getDailyStats(branchId, targetDate);
  }
}
