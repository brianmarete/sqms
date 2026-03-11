import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import type { JwtStaffPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async validateStaff(email: string, password: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!staff) throw new UnauthorizedException('Invalid email or password');

    const ok = await bcrypt.compare(password, staff.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');

    return staff;
  }

  async createAccessToken(staff: { id: string; email: string; role: any; branchId: string }) {
    const payload: JwtStaffPayload = {
      sub: staff.id,
      email: staff.email,
      role: staff.role,
      branchId: staff.branchId,
      serviceId: (staff as any).serviceId ?? null,
    };

    return this.jwt.signAsync(payload);
  }
}

