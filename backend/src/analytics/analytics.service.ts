import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDailyStats(branchId: string, date?: Date) {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const tickets = await this.prisma.ticket.findMany({
      where: {
        branchId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const completed = tickets.filter((t) => t.status === TicketStatus.COMPLETED);
    const cancelled = tickets.filter((t) => t.status === TicketStatus.CANCELLED);
    const waiting = tickets.filter((t) => t.status === TicketStatus.WAITING);
    const serving = tickets.filter((t) => t.status === TicketStatus.SERVING);

    // Calculate average wait time (calledAt - createdAt)
    const waitTimes = completed
      .filter((t) => t.calledAt)
      .map((t) => {
        const waitTime = t.calledAt.getTime() - t.createdAt.getTime();
        return waitTime / 1000 / 60; // Convert to minutes
      });

    const avgWaitTime =
      waitTimes.length > 0
        ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
        : 0;

    // Calculate average service time (completedAt - calledAt)
    const serviceTimes = completed
      .filter((t) => t.calledAt && t.completedAt)
      .map((t) => {
        const serviceTime = t.completedAt.getTime() - t.calledAt.getTime();
        return serviceTime / 1000 / 60; // Convert to minutes
      });

    const avgServiceTime =
      serviceTimes.length > 0
        ? serviceTimes.reduce((a, b) => a + b, 0) / serviceTimes.length
        : 0;

    return {
      date: targetDate.toISOString().split('T')[0],
      total: tickets.length,
      completed: completed.length,
      cancelled: cancelled.length,
      waiting: waiting.length,
      serving: serving.length,
      averageWaitTime: Math.round(avgWaitTime * 10) / 10,
      averageServiceTime: Math.round(avgServiceTime * 10) / 10,
    };
  }
}
