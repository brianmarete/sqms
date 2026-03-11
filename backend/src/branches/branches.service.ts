import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.branch.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async get(branchId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  create(dto: CreateBranchDto) {
    return this.prisma.branch.create({
      data: { name: dto.name },
    });
  }

  async update(branchId: string, dto: UpdateBranchDto) {
    await this.get(branchId);
    return this.prisma.branch.update({
      where: { id: branchId },
      data: { ...dto },
    });
  }

  async remove(branchId: string) {
    await this.get(branchId);
    return this.prisma.branch.delete({ where: { id: branchId } });
  }
}

