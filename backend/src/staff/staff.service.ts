import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.staff.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        role: true,
        branchId: true,
        serviceId: true,
        createdAt: true,
        updatedAt: true,
        branch: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, counterLabel: true, branchId: true } },
      },
    });
  }

  async get(staffId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        email: true,
        role: true,
        branchId: true,
        serviceId: true,
        createdAt: true,
        updatedAt: true,
        branch: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, counterLabel: true, branchId: true } },
      },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    return staff;
  }

  async create(dto: CreateStaffDto) {
    const email = dto.email.toLowerCase();

    // Validate branch exists
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
    if (!branch) throw new NotFoundException('Branch not found');

    // Validate service belongs to branch (if provided)
    if (dto.serviceId) {
      const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
      if (!service) throw new NotFoundException('Service not found');
      if (service.branchId !== dto.branchId) {
        throw new BadRequestException('Service does not belong to branch');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.staff.create({
      data: {
        email,
        passwordHash,
        role: dto.role,
        branchId: dto.branchId,
        serviceId: dto.serviceId ?? null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        branchId: true,
        serviceId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(staffId: string, dto: UpdateStaffDto) {
    const existing = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!existing) throw new NotFoundException('Staff not found');

    const branchId = dto.branchId ?? existing.branchId;
    const serviceId = dto.serviceId === undefined ? existing.serviceId : dto.serviceId;

    // Validate branch exists if changing
    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch) throw new NotFoundException('Branch not found');
    }

    // Validate service belongs to resulting branch (if set)
    if (serviceId) {
      const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
      if (!service) throw new NotFoundException('Service not found');
      if (service.branchId !== branchId) throw new BadRequestException('Service does not belong to branch');
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : undefined;

    return this.prisma.staff.update({
      where: { id: staffId },
      data: {
        email: dto.email ? dto.email.toLowerCase() : undefined,
        passwordHash,
        role: dto.role,
        branchId: dto.branchId,
        serviceId: dto.serviceId === undefined ? undefined : dto.serviceId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        branchId: true,
        serviceId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(staffId: string) {
    const existing = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!existing) throw new NotFoundException('Staff not found');
    return this.prisma.staff.delete({
      where: { id: staffId },
      select: { id: true, email: true },
    });
  }
}

