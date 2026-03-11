import { PrismaClient, TicketCancelReason, TicketChannel, TicketStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60_000);
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

async function main() {
  const now = new Date();

  // Create default branch if it doesn't exist
  const defaultBranch = await prisma.branch.upsert({
    where: { id: 'default-branch' },
    update: {},
    create: {
      id: 'default-branch',
      name: 'Main Branch',
    },
  });

  console.log('Default branch created:', defaultBranch);

  // Ensure default services for the branch
  const defaultServices = [
    { name: 'Support', counterLabel: 'Counter 1' },
    { name: 'Account Opening', counterLabel: 'Counter 2' },
    { name: 'Cash Deposit', counterLabel: 'Counter 3' },
    { name: 'Loan Inquiry', counterLabel: 'Counter 4' },
    { name: 'Card Services', counterLabel: 'Counter 5' },
  ];

  for (const s of defaultServices) {
    await prisma.service.upsert({
      where: { branchId_name: { branchId: defaultBranch.id, name: s.name } },
      update: { counterLabel: s.counterLabel, isActive: true },
      create: {
        branchId: defaultBranch.id,
        name: s.name,
        counterLabel: s.counterLabel,
        isActive: true,
      },
    });
  }

  // Additional branches
  const uptownBranch = await prisma.branch.upsert({
    where: { id: 'uptown-branch' },
    update: {},
    create: {
      id: 'uptown-branch',
      name: 'Uptown Branch',
    },
  });

  const westBranch = await prisma.branch.upsert({
    where: { id: 'west-branch' },
    update: {},
    create: {
      id: 'west-branch',
      name: 'West Branch',
    },
  });

  // Services for additional branches
  const uptownServices = [
    { name: 'Teller', counterLabel: 'Counter A' },
    { name: 'Loans', counterLabel: 'Loans Desk' },
    { name: 'Business Banking', counterLabel: 'BB Counter' },
    { name: 'Customer Care', counterLabel: 'Help Desk' },
  ];

  for (const s of uptownServices) {
    await prisma.service.upsert({
      where: { branchId_name: { branchId: uptownBranch.id, name: s.name } },
      update: { counterLabel: s.counterLabel, isActive: true },
      create: { branchId: uptownBranch.id, name: s.name, counterLabel: s.counterLabel, isActive: true },
    });
  }

  const westServices = [
    { name: 'Cash', counterLabel: 'Counter 1' },
    { name: 'New Accounts', counterLabel: 'Counter 2' },
    { name: 'Cards', counterLabel: 'Counter 3' },
  ];

  for (const s of westServices) {
    await prisma.service.upsert({
      where: { branchId_name: { branchId: westBranch.id, name: s.name } },
      update: { counterLabel: s.counterLabel, isActive: true },
      create: { branchId: westBranch.id, name: s.name, counterLabel: s.counterLabel, isActive: true },
    });
  }

  // Fetch service IDs we need for staff + tickets
  const mainSupport = await prisma.service.findUnique({
    where: { branchId_name: { branchId: defaultBranch.id, name: 'Support' } },
  });
  const mainCashDeposit = await prisma.service.findUnique({
    where: { branchId_name: { branchId: defaultBranch.id, name: 'Cash Deposit' } },
  });
  const mainLoanInquiry = await prisma.service.findUnique({
    where: { branchId_name: { branchId: defaultBranch.id, name: 'Loan Inquiry' } },
  });
  const uptownTeller = await prisma.service.findUnique({
    where: { branchId_name: { branchId: uptownBranch.id, name: 'Teller' } },
  });
  const uptownLoans = await prisma.service.findUnique({
    where: { branchId_name: { branchId: uptownBranch.id, name: 'Loans' } },
  });
  const westCash = await prisma.service.findUnique({
    where: { branchId_name: { branchId: westBranch.id, name: 'Cash' } },
  });

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@sqms.local').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.staff.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      branchId: defaultBranch.id,
      serviceId: null,
    },
  });

  console.log('Admin staff ensured:', { id: admin.id, email: admin.email, role: admin.role });

  // Seed staff (idempotent by email)
  const staffPassword = process.env.SEED_STAFF_PASSWORD || 'staff123';
  const staffPasswordHash = await bcrypt.hash(staffPassword, 12);

  await prisma.staff.upsert({
    where: { email: 'support.agent@sqms.local' },
    update: {
      branchId: defaultBranch.id,
      serviceId: mainSupport?.id ?? null,
      role: 'STAFF',
    },
    create: {
      email: 'support.agent@sqms.local',
      passwordHash: staffPasswordHash,
      role: 'STAFF',
      branchId: defaultBranch.id,
      serviceId: mainSupport?.id ?? null,
    },
  });

  await prisma.staff.upsert({
    where: { email: 'teller1@sqms.local' },
    update: {
      branchId: uptownBranch.id,
      serviceId: uptownTeller?.id ?? null,
      role: 'STAFF',
    },
    create: {
      email: 'teller1@sqms.local',
      passwordHash: staffPasswordHash,
      role: 'STAFF',
      branchId: uptownBranch.id,
      serviceId: uptownTeller?.id ?? null,
    },
  });

  await prisma.staff.upsert({
    where: { email: 'loans.officer@sqms.local' },
    update: {
      branchId: uptownBranch.id,
      serviceId: uptownLoans?.id ?? null,
      role: 'STAFF',
    },
    create: {
      email: 'loans.officer@sqms.local',
      passwordHash: staffPasswordHash,
      role: 'STAFF',
      branchId: uptownBranch.id,
      serviceId: uptownLoans?.id ?? null,
    },
  });

  await prisma.staff.upsert({
    where: { email: 'west.cashier@sqms.local' },
    update: {
      branchId: westBranch.id,
      serviceId: westCash?.id ?? null,
      role: 'STAFF',
    },
    create: {
      email: 'west.cashier@sqms.local',
      passwordHash: staffPasswordHash,
      role: 'STAFF',
      branchId: westBranch.id,
      serviceId: westCash?.id ?? null,
    },
  });

  // Seed deterministic tickets (idempotent by fixed ID)
  // Notes:
  // - Tickets are created in Postgres only (Redis queues are runtime state).
  // - serviceType is derived from the service name.
  const tickets = [
    {
      id: 'seed-ticket-main-001',
      branchId: defaultBranch.id,
      serviceId: mainSupport?.id ?? null,
      serviceType: 'Support',
      ticketNo: 'M-201',
      customerName: 'Alice W.',
      phone: '+254700000001',
      status: 'WAITING' as const,
      createdAt: new Date(now.getTime() - 1000 * 60 * 18),
    },
    {
      id: 'seed-ticket-main-002',
      branchId: defaultBranch.id,
      serviceId: mainCashDeposit?.id ?? null,
      serviceType: 'Cash Deposit',
      ticketNo: 'M-202',
      customerName: 'Brian K.',
      phone: '+254700000002',
      status: 'WAITING' as const,
      createdAt: new Date(now.getTime() - 1000 * 60 * 12),
    },
    {
      id: 'seed-ticket-main-003',
      branchId: defaultBranch.id,
      serviceId: mainLoanInquiry?.id ?? null,
      serviceType: 'Loan Inquiry',
      ticketNo: 'M-203',
      customerName: 'Carol N.',
      phone: '+254700000003',
      status: 'SERVING' as const,
      createdAt: new Date(now.getTime() - 1000 * 60 * 35),
      calledAt: new Date(now.getTime() - 1000 * 60 * 5),
    },
    {
      id: 'seed-ticket-main-004',
      branchId: defaultBranch.id,
      serviceId: mainSupport?.id ?? null,
      serviceType: 'Support',
      ticketNo: 'M-204',
      customerName: 'David O.',
      phone: '+254700000004',
      status: 'COMPLETED' as const,
      createdAt: new Date(now.getTime() - 1000 * 60 * 90),
      calledAt: new Date(now.getTime() - 1000 * 60 * 70),
      completedAt: new Date(now.getTime() - 1000 * 60 * 60),
    },
    {
      id: 'seed-ticket-uptown-001',
      branchId: uptownBranch.id,
      serviceId: uptownTeller?.id ?? null,
      serviceType: 'Teller',
      ticketNo: 'U-101',
      customerName: 'Eunice P.',
      phone: '+254700000005',
      status: 'WAITING' as const,
      createdAt: new Date(now.getTime() - 1000 * 60 * 9),
    },
    {
      id: 'seed-ticket-uptown-002',
      branchId: uptownBranch.id,
      serviceId: uptownLoans?.id ?? null,
      serviceType: 'Loans',
      ticketNo: 'U-102',
      customerName: 'Frank S.',
      phone: '+254700000006',
      status: 'COMPLETED' as const,
      createdAt: new Date(now.getTime() - 1000 * 60 * 140),
      calledAt: new Date(now.getTime() - 1000 * 60 * 120),
      completedAt: new Date(now.getTime() - 1000 * 60 * 105),
    },
    {
      id: 'seed-ticket-west-001',
      branchId: westBranch.id,
      serviceId: westCash?.id ?? null,
      serviceType: 'Cash',
      ticketNo: 'W-301',
      customerName: 'Grace T.',
      phone: '+254700000007',
      status: 'CANCELLED' as const,
      createdAt: new Date(now.getTime() - 1000 * 60 * 55),
    },
  ];

  for (const t of tickets) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {
        ticketNo: t.ticketNo,
        customerName: t.customerName,
        phone: t.phone,
        status: t.status,
        branchId: t.branchId,
        serviceId: t.serviceId,
        serviceType: t.serviceType,
        channel: TicketChannel.WEB,
        createdAt: t.createdAt,
        calledAt: (t as any).calledAt ?? null,
        completedAt: (t as any).completedAt ?? null,
        cancelledAt: (t as any).cancelledAt ?? null,
        cancelReason: (t as any).cancelReason ?? null,
        calledByStaffId: (t as any).calledByStaffId ?? null,
        completedByStaffId: (t as any).completedByStaffId ?? null,
        cancelledByStaffId: (t as any).cancelledByStaffId ?? null,
      },
      create: {
        id: t.id,
        ticketNo: t.ticketNo,
        customerName: t.customerName,
        phone: t.phone,
        status: t.status,
        branchId: t.branchId,
        serviceId: t.serviceId,
        serviceType: t.serviceType,
        channel: TicketChannel.WEB,
        createdAt: t.createdAt,
        calledAt: (t as any).calledAt ?? null,
        completedAt: (t as any).completedAt ?? null,
        cancelledAt: (t as any).cancelledAt ?? null,
        cancelReason: (t as any).cancelReason ?? null,
        calledByStaffId: (t as any).calledByStaffId ?? null,
        completedByStaffId: (t as any).completedByStaffId ?? null,
        cancelledByStaffId: (t as any).cancelledByStaffId ?? null,
      },
    });
  }

  // ------------------------------------------------------------
  // 30-day analytics dataset (idempotent, deterministic)
  // ------------------------------------------------------------
  const DAYS = Number(process.env.SEED_ANALYTICS_DAYS || 30);
  const MAX_PER_DAY = Number(process.env.SEED_ANALYTICS_MAX_TICKETS_PER_DAY || 120);
  const SEED = Number(process.env.SEED_ANALYTICS_RANDOM_SEED || 1337);
  const rand = mulberry32(SEED);

  const branches = await prisma.branch.findMany({
    where: { id: { in: [defaultBranch.id, uptownBranch.id, westBranch.id] } },
    select: { id: true, name: true },
  });

  const services = await prisma.service.findMany({
    where: { branchId: { in: branches.map((b) => b.id) }, isActive: true },
    select: { id: true, branchId: true, name: true },
  });

  const staff = await prisma.staff.findMany({
    where: { role: 'STAFF', branchId: { in: branches.map((b) => b.id) } },
    select: { id: true, email: true, branchId: true, serviceId: true },
  });

  const staffByBranch = new Map<string, typeof staff>();
  for (const s of staff) {
    const arr = staffByBranch.get(s.branchId) ?? [];
    arr.push(s);
    staffByBranch.set(s.branchId, arr);
  }

  const servicesByBranch = new Map<string, typeof services>();
  for (const sv of services) {
    const arr = servicesByBranch.get(sv.branchId) ?? [];
    arr.push(sv);
    servicesByBranch.set(sv.branchId, arr);
  }

  // Clear previous generated history (keep deterministic single tickets above)
  await prisma.ticket.deleteMany({
    where: { id: { startsWith: 'seed-hist-' } },
  });

  const periodEnd = endOfDay(now);
  const periodStart = startOfDay(new Date(periodEnd));
  periodStart.setDate(periodStart.getDate() - (DAYS - 1));

  const phoneFor = (i: number) => `+25471${String(1000000 + (i % 9000000)).slice(0, 7)}`;
  const customerFor = (i: number) => `Customer ${String(i).padStart(4, '0')}`;

  let globalCounter = 1;
  const rows: any[] = [];

  for (let dayOffset = 0; dayOffset < DAYS; dayOffset++) {
    const day = new Date(periodStart);
    day.setDate(day.getDate() + dayOffset);
    const dow = day.getDay(); // 0=Sun

    // Higher volume on weekdays, lower on weekends.
    const weekdayFactor = dow === 0 || dow === 6 ? 0.35 : dow === 5 ? 0.75 : 1.0;

    for (const b of branches) {
      const branchFactor = b.id === defaultBranch.id ? 1.0 : b.id === uptownBranch.id ? 0.75 : 0.55;
      const base = MAX_PER_DAY * weekdayFactor * branchFactor;
      const nTickets = clamp(Math.floor(base * (0.6 + rand() * 0.8)), 8, MAX_PER_DAY);

      const branchServices = servicesByBranch.get(b.id) ?? [];
      const branchStaff = staffByBranch.get(b.id) ?? [];

      for (let i = 0; i < nTickets; i++) {
        // Create times spread between 8am-5pm
        const minuteOfDay = Math.floor((8 * 60) + rand() * (9 * 60)); // 8:00 to 17:00
        const createdAt = new Date(day);
        createdAt.setHours(0, 0, 0, 0);
        createdAt.setMinutes(minuteOfDay);

        const service = branchServices[Math.floor(rand() * Math.max(1, branchServices.length))] ?? null;
        const serviceType = service?.name ?? 'Support';
        const serviceId = service?.id ?? null;

        // For now we only have kiosk in production, so keep all
        // seeded tickets on the KIOSK channel for realistic data.
        const channel = TicketChannel.KIOSK;

        // Status mix
        const statusRoll = rand();
        let status: TicketStatus;
        if (dayOffset === DAYS - 1 && statusRoll < 0.08) status = TicketStatus.WAITING;
        else if (dayOffset === DAYS - 1 && statusRoll < 0.12) status = TicketStatus.SERVING;
        else if (statusRoll < 0.82) status = TicketStatus.COMPLETED;
        else status = TicketStatus.CANCELLED;

        // Wait time distribution (minutes)
        const waitMinutes =
          status === TicketStatus.CANCELLED
            ? clamp(Math.floor(2 + rand() * 40), 1, 120)
            : clamp(Math.floor(1 + rand() * 35 + (rand() < 0.1 ? rand() * 40 : 0)), 1, 180);

        // Service duration distribution (minutes)
        const serviceMinutes = clamp(Math.floor(3 + rand() * 18 + (rand() < 0.08 ? rand() * 25 : 0)), 2, 90);

        const calledAt =
          status === TicketStatus.WAITING ? null : addMinutes(createdAt, waitMinutes);

        const completedAt =
          status === TicketStatus.COMPLETED ? addMinutes(calledAt!, serviceMinutes) : null;

        const cancelledAt =
          status === TicketStatus.CANCELLED ? addMinutes(createdAt, clamp(Math.floor(1 + rand() * 50), 1, 240)) : null;

        const cancelReason =
          status === TicketStatus.CANCELLED
            ? rand() < 0.35
              ? TicketCancelReason.NO_SHOW
              : TicketCancelReason.CANCELLED
            : null;

        // Staff attribution: prefer staff assigned to the service, else any staff in branch.
        const serviceStaff = branchStaff.filter((s) => s.serviceId && s.serviceId === serviceId);
        const pickStaff = () => {
          const pool = serviceStaff.length > 0 ? serviceStaff : branchStaff;
          return pool.length === 0 ? null : pool[Math.floor(rand() * pool.length)];
        };

        const calledBy = status === TicketStatus.WAITING ? null : pickStaff();
        const completedBy = status === TicketStatus.COMPLETED ? (calledBy ?? pickStaff()) : null;
        const cancelledBy = status === TicketStatus.CANCELLED ? pickStaff() : null;

        // Ticket numbers per branch (simple monotonic)
        const prefix = b.name.charAt(0).toUpperCase();
        const ticketNo = `${prefix}-${String(1000 + ((dayOffset * 500 + i) % 9000)).padStart(4, '0')}`;

        rows.push({
          id: `seed-hist-${String(globalCounter++).padStart(6, '0')}`,
          ticketNo,
          customerName: customerFor(globalCounter),
          phone: phoneFor(globalCounter),
          status,
          channel,
          serviceType,
          serviceId,
          branchId: b.id,
          createdAt,
          calledAt,
          completedAt,
          cancelledAt,
          cancelReason,
          calledByStaffId: calledBy?.id ?? null,
          completedByStaffId: completedBy?.id ?? null,
          cancelledByStaffId: cancelledBy?.id ?? null,
        });
      }
    }
  }

  // Bulk insert
  // Note: `createMany` skips relations but accepts FK ids, which is what we want.
  const chunkSize = 2000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await prisma.ticket.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log(`Seeded analytics tickets: ${rows.length} rows over ${DAYS} days (${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
