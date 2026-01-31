import { Controller, Post, Get, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { QueueService } from './queue.service';
import { JoinQueueDto } from './dto/join-queue.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StaffRole } from '@prisma/client';
import type { Request } from 'express';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('join')
  async joinQueue(@Body() dto: JoinQueueDto) {
    return this.queueService.joinQueue(dto);
  }

  @Get('active')
  async getActiveQueue(@Query('branchId') branchId: string) {
    return this.queueService.getActiveQueue(branchId);
  }

  @Get('current-serving')
  async getCurrentServing(@Query('branchId') branchId: string) {
    return this.queueService.getCurrentServing(branchId);
  }

  @Patch('call-next')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.STAFF, StaffRole.ADMIN)
  async callNext(@Query('branchId') branchId: string, @Req() req: Request) {
    const user = req.user as { branchId: string };
    return this.queueService.callNext(branchId, user.branchId);
  }

  @Patch('complete/:ticketId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.STAFF, StaffRole.ADMIN)
  async completeTicket(@Param('ticketId') ticketId: string, @Req() req: Request) {
    const user = req.user as { branchId: string };
    return this.queueService.completeTicket(ticketId, user.branchId);
  }

  @Patch('cancel/:ticketId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(StaffRole.STAFF, StaffRole.ADMIN)
  async cancelTicket(
    @Param('ticketId') ticketId: string,
    @Query('reason') reason: 'no-show' | 'cancelled' = 'cancelled',
    @Req() req: Request,
  ) {
    const user = req.user as { branchId: string };
    return this.queueService.cancelTicket(ticketId, reason, user.branchId);
  }
}
