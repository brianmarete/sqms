import type { StaffRole } from '@prisma/client';

export type JwtStaffPayload = {
  sub: string;
  email: string;
  role: StaffRole;
  branchId: string;
};

