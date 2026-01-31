import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SmsService } from '../sms/sms.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { TicketStatus } from '@prisma/client';
import { JoinQueueDto } from './dto/join-queue.dto';

@Injectable()
export class QueueService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private smsService: SmsService,
    private websocketGateway: WebsocketGateway,
  ) {}

  async joinQueue(dto: JoinQueueDto) {
    // Get branch to generate ticket number
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branchId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Generate ticket number (e.g., A-101)
    const ticketCount = await this.prisma.ticket.count({
      where: { branchId: dto.branchId },
    });
    const ticketNo = `${branch.name.charAt(0).toUpperCase()}-${ticketCount + 1}`;

    // Create ticket in PostgreSQL
    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNo,
        customerName: dto.customerName,
        phone: dto.phone,
        serviceType: dto.serviceType,
        branchId: dto.branchId,
        status: TicketStatus.WAITING,
      },
    });

    // Add to Redis queue
    await this.redis.addToQueue(dto.branchId, ticket.id);

    // Get queue position
    const queueLength = await this.redis.getQueueLength(dto.branchId);
    const position = queueLength;

    // Send SMS notification
    await this.smsService.sendQueueConfirmation(
      dto.phone,
      ticketNo,
      position - 1, // People ahead
    );

    // Emit WebSocket event to staff dashboard
    this.websocketGateway.broadcastQueueUpdate(dto.branchId);

    return {
      ticketId: ticket.id,
      ticketNo: ticket.ticketNo,
      position,
      estimatedWaitTime: this.calculateEstimatedWaitTime(position - 1),
    };
  }

  async getActiveQueue(branchId: string) {
    // Get all ticket IDs from Redis
    const ticketIds = await this.redis.getAllFromQueue(branchId);

    if (ticketIds.length === 0) {
      return [];
    }

    // Fetch ticket details from PostgreSQL
    const tickets = await this.prisma.ticket.findMany({
      where: {
        id: { in: ticketIds },
        status: { in: [TicketStatus.WAITING, TicketStatus.SERVING] },
      },
      include: {
        branch: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return tickets;
  }

  async getCurrentServing(branchId: string) {
    const ticketId = await this.redis.getCurrentServing(branchId);
    if (!ticketId) return null;

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { branch: true },
    });

    // If the ticket no longer exists or is no longer serving, clear the key.
    if (!ticket || ticket.status !== TicketStatus.SERVING) {
      await this.redis.clearCurrentServing(branchId);
      return null;
    }

    return ticket;
  }

  async callNext(branchId: string, staffBranchId: string) {
    if (branchId !== staffBranchId) {
      throw new ForbiddenException('You are not allowed to manage this branch');
    }

    // Pop next ticket from Redis
    const ticketId = await this.redis.getNextFromQueue(branchId);

    if (!ticketId) {
      throw new NotFoundException('No tickets in queue');
    }

    // Update ticket status in PostgreSQL
    const ticket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.SERVING,
        calledAt: new Date(),
      },
      include: {
        branch: true,
      },
    });

    // Persist "currently serving" for display screens / refreshes
    await this.redis.setCurrentServing(branchId, ticket.id);

    // Emit WebSocket event
    this.websocketGateway.broadcastQueueUpdate(branchId);
    this.websocketGateway.broadcastTicketUpdate(branchId, ticket);

    return ticket;
  }

  async completeTicket(ticketId: string, staffBranchId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { branch: true },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.branchId !== staffBranchId) {
      throw new ForbiddenException('You are not allowed to manage this ticket');
    }

    const wasServing = ticket.status === TicketStatus.SERVING;

    // Update status
    const updatedTicket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: {
        branch: true,
      },
    });

    // Remove from Redis queue if still there
    await this.redis.removeFromQueue(ticket.branchId, ticketId);

    if (wasServing) {
      await this.redis.clearCurrentServing(ticket.branchId);
      this.websocketGateway.broadcastTicketUpdate(ticket.branchId, null);
    }

    // Emit WebSocket event
    this.websocketGateway.broadcastQueueUpdate(ticket.branchId);

    return updatedTicket;
  }

  async cancelTicket(ticketId: string, reason: 'no-show' | 'cancelled', staffBranchId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { branch: true },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.branchId !== staffBranchId) {
      throw new ForbiddenException('You are not allowed to manage this ticket');
    }

    const wasServing = ticket.status === TicketStatus.SERVING;

    // Update status
    const updatedTicket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.CANCELLED,
      },
      include: {
        branch: true,
      },
    });

    // Remove from Redis queue
    await this.redis.removeFromQueue(ticket.branchId, ticketId);

    if (wasServing) {
      await this.redis.clearCurrentServing(ticket.branchId);
      this.websocketGateway.broadcastTicketUpdate(ticket.branchId, null);
    }

    // Emit WebSocket event
    this.websocketGateway.broadcastQueueUpdate(ticket.branchId);

    return updatedTicket;
  }

  private calculateEstimatedWaitTime(peopleAhead: number): number {
    // Average 5 minutes per customer
    return peopleAhead * 5;
  }
}
