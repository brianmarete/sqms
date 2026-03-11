import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SmsService } from '../sms/sms.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { TicketCancelReason, TicketChannel, TicketStatus } from '@prisma/client';
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

    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });

    if (!service || service.branchId !== dto.branchId) {
      throw new NotFoundException('Service not found for this branch');
    }

    if (!service.isActive) {
      throw new NotFoundException('Service is not active');
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
        serviceType: service.name,
        serviceId: service.id,
        branchId: dto.branchId,
        status: TicketStatus.WAITING,
        channel: (dto.channel as TicketChannel | undefined) ?? TicketChannel.WEB,
      },
    });

    // Add to Redis queue
    await this.redis.addToQueue(dto.branchId, ticket.id, service.id);

    // Get queue position
    const queueLength = await this.redis.getQueueLength(dto.branchId, service.id);
    const position = queueLength;

    // Send SMS notification
    await this.smsService.sendQueueConfirmation(
      dto.phone,
      ticketNo,
      position - 1, // People ahead
    );

    // Emit WebSocket event to staff dashboard (service-specific + branch-wide fallback)
    this.websocketGateway.broadcastQueueUpdate(dto.branchId, service.id);
    this.websocketGateway.broadcastQueueUpdate(dto.branchId);

    return {
      ticketId: ticket.id,
      ticketNo: ticket.ticketNo,
      position,
      estimatedWaitTime: this.calculateEstimatedWaitTime(position - 1),
    };
  }

  async getActiveQueue(branchId: string, serviceId?: string) {
    // Get all ticket IDs from Redis
    const ticketIds = await this.redis.getAllFromQueue(branchId, serviceId);

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
        service: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return tickets;
  }

  async getCurrentServing(branchId: string, serviceId?: string) {
    const ticketId = await this.redis.getCurrentServing(branchId, serviceId);
    if (!ticketId) return null;

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { branch: true, service: true },
    });

    // If the ticket no longer exists or is no longer serving, clear the key.
    if (!ticket || ticket.status !== TicketStatus.SERVING) {
      await this.redis.clearCurrentServing(branchId, serviceId);
      return null;
    }

    return ticket;
  }

  async callNext(branchId: string, staffBranchId: string, staffId: string, serviceId?: string) {
    if (branchId !== staffBranchId) {
      throw new ForbiddenException('You are not allowed to manage this branch');
    }

    if (!serviceId) {
      throw new NotFoundException('Staff is not assigned to a service');
    }

    // Pop next ticket from Redis
    const ticketId = await this.redis.getNextFromQueue(branchId, serviceId);

    if (!ticketId) {
      throw new NotFoundException('No tickets in queue');
    }

    // Update ticket status in PostgreSQL
    const ticket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.SERVING,
        calledAt: new Date(),
        calledByStaffId: staffId,
      },
      include: {
        branch: true,
        service: true,
      },
    });

    // Persist "currently serving" for display screens / refreshes
    await this.redis.setCurrentServing(branchId, ticket.id, serviceId);
    await this.redis.setCurrentServing(branchId, ticket.id);

    // Emit WebSocket event (service-specific + branch-wide fallback)
    this.websocketGateway.broadcastQueueUpdate(branchId, serviceId);
    this.websocketGateway.broadcastTicketUpdate(branchId, ticket, serviceId);
    this.websocketGateway.broadcastQueueUpdate(branchId);
    this.websocketGateway.broadcastTicketUpdate(branchId, ticket);

    return ticket;
  }

  async completeTicket(ticketId: string, staffBranchId: string, staffId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { branch: true, service: true },
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
        completedByStaffId: staffId,
      },
      include: {
        branch: true,
        service: true,
      },
    });

    // Remove from Redis queue if still there
    await this.redis.removeFromQueue(ticket.branchId, ticketId, ticket.serviceId);

    if (wasServing) {
      await this.redis.clearCurrentServing(ticket.branchId, ticket.serviceId);
      await this.redis.clearCurrentServing(ticket.branchId);
      this.websocketGateway.broadcastTicketUpdate(ticket.branchId, null, ticket.serviceId);
      this.websocketGateway.broadcastTicketUpdate(ticket.branchId, null);
    }

    // Emit WebSocket event
    this.websocketGateway.broadcastQueueUpdate(ticket.branchId, ticket.serviceId);
    this.websocketGateway.broadcastQueueUpdate(ticket.branchId);

    return updatedTicket;
  }

  async cancelTicket(
    ticketId: string,
    reason: 'no-show' | 'cancelled',
    staffBranchId: string,
    staffId: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { branch: true, service: true },
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
        cancelledAt: new Date(),
        cancelReason: reason === 'no-show' ? TicketCancelReason.NO_SHOW : TicketCancelReason.CANCELLED,
        cancelledByStaffId: staffId,
      },
      include: {
        branch: true,
        service: true,
      },
    });

    // Remove from Redis queue
    await this.redis.removeFromQueue(ticket.branchId, ticketId, ticket.serviceId);

    if (wasServing) {
      await this.redis.clearCurrentServing(ticket.branchId, ticket.serviceId);
      await this.redis.clearCurrentServing(ticket.branchId);
      this.websocketGateway.broadcastTicketUpdate(ticket.branchId, null, ticket.serviceId);
      this.websocketGateway.broadcastTicketUpdate(ticket.branchId, null);
    }

    // Emit WebSocket event
    this.websocketGateway.broadcastQueueUpdate(ticket.branchId, ticket.serviceId);
    this.websocketGateway.broadcastQueueUpdate(ticket.branchId);

    return updatedTicket;
  }

  private calculateEstimatedWaitTime(peopleAhead: number): number {
    // Average 5 minutes per customer
    return peopleAhead * 5;
  }
}
