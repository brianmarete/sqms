import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async listForBranch(branchId: string, opts?: { activeOnly?: boolean }) {
    // ensure branch exists for clearer error messages
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');

    return this.prisma.service.findMany({
      where: {
        branchId,
        ...(opts?.activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async get(serviceId: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async create(branchId: string, dto: CreateServiceDto) {
    // validate branch exists
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');

    return this.prisma.service.create({
      data: {
        branchId,
        name: dto.name,
        counterLabel: dto.counterLabel,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(branchId: string, serviceId: string, dto: UpdateServiceDto) {
    const service = await this.get(serviceId);
    if (service.branchId !== branchId) throw new BadRequestException('Service does not belong to branch');

    return this.prisma.service.update({
      where: { id: serviceId },
      data: { ...dto },
    });
  }

  async remove(branchId: string, serviceId: string) {
    const service = await this.get(serviceId);
    if (service.branchId !== branchId) throw new BadRequestException('Service does not belong to branch');
    return this.prisma.service.delete({ where: { id: serviceId } });
  }
}

