import { Controller, ForbiddenException, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
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

  @Get('summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.ADMIN)
  async getSummary(
    @Req() req: Request,
    @Query('branchId') branchId?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('volumeGranularity') volumeGranularity?: 'hour' | 'day' | 'week',
    @Query('slaThresholdMinutes') slaThresholdMinutes?: string,
  ) {
    const user = req.user as { role: StaffRole; branchId: string };
    if (user.role !== StaffRole.ADMIN) {
      throw new ForbiddenException('Only ADMIN can access analytics summary');
    }

    return this.analyticsService.getSummary({
      branchId,
      start,
      end,
      volumeGranularity,
      slaThresholdMinutes: slaThresholdMinutes ? Number(slaThresholdMinutes) : undefined,
    });
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.ADMIN)
  async exportReport(
    @Req() req: Request,
    @Query('report')
    report:
      | 'queue-volume'
      | 'wait-times'
      | 'service-durations'
      | 'sla'
      | 'abandonment'
      | 'throughput'
      | 'staff-performance',
    @Query('branchId') branchId?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('volumeGranularity') volumeGranularity?: 'hour' | 'day' | 'week',
    @Query('slaThresholdMinutes') slaThresholdMinutes?: string,
  ) {
    const user = req.user as { role: StaffRole };
    if (user.role !== StaffRole.ADMIN) {
      throw new ForbiddenException('Only ADMIN can export reports');
    }

    return this.analyticsService.exportReportCsv({
      report,
      branchId,
      start,
      end,
      volumeGranularity,
      slaThresholdMinutes: slaThresholdMinutes ? Number(slaThresholdMinutes) : undefined,
    });
  }
}
