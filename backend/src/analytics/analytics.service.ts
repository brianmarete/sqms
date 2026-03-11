import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketCancelReason, TicketChannel, TicketStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private parseRange(input: {
    start?: string;
    end?: string;
  }): { start: Date; end: Date } {
    const now = new Date();
    const end = input.end ? new Date(input.end) : now;
    const start = input.start ? new Date(input.start) : new Date(end);

    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      // fall back to last 7 days if invalid
      const fallbackEnd = now;
      const fallbackStart = new Date(now);
      fallbackStart.setDate(fallbackStart.getDate() - 6);
      fallbackStart.setHours(0, 0, 0, 0);
      fallbackEnd.setHours(23, 59, 59, 999);
      return { start: fallbackStart, end: fallbackEnd };
    }

    // Normalize to inclusive day bounds if provided as YYYY-MM-DD
    if (input.start && input.start.length === 10) start.setHours(0, 0, 0, 0);
    if (input.end && input.end.length === 10) end.setHours(23, 59, 59, 999);

    if (start > end) return { start: end, end: start };
    return { start, end };
  }

  private bucketKey(date: Date, granularity: 'hour' | 'day' | 'week') {
    const d = new Date(date);
    if (granularity === 'hour') {
      d.setMinutes(0, 0, 0);
      return d.toISOString().slice(0, 13) + ':00';
    }
    if (granularity === 'day') {
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    }
    // ISO week bucket: YYYY-Www
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const year = tmp.getUTCFullYear();
    return `${year}-W${String(weekNo).padStart(2, '0')}`;
  }

  private quantile(sorted: number[], q: number) {
    if (sorted.length === 0) return 0;
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    const next = sorted[base + 1];
    return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
  }

  private toCsv(rows: Array<Record<string, any>>) {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const esc = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
      return s;
    };
    return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
  }

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

  async getSummary(input: {
    branchId?: string;
    start?: string;
    end?: string;
    volumeGranularity?: 'hour' | 'day' | 'week';
    slaThresholdMinutes?: number;
  }) {
    const { start, end } = this.parseRange({ start: input.start, end: input.end });
    const volumeGranularity = input.volumeGranularity ?? 'day';
    const slaThresholdMinutes = Number.isFinite(input.slaThresholdMinutes)
      ? (input.slaThresholdMinutes as number)
      : 10;

    const tickets = await this.prisma.ticket.findMany({
      where: {
        ...(input.branchId ? { branchId: input.branchId } : {}),
        createdAt: { gte: start, lte: end },
      },
      include: {
        branch: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
        calledByStaff: { select: { id: true, email: true } },
        completedByStaff: { select: { id: true, email: true } },
        cancelledByStaff: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const queueVolumeRows = this.computeQueueVolume(tickets, volumeGranularity);
    const waitTimeRows = this.computeWaitTimes(tickets);
    const serviceDurationRows = this.computeServiceDurations(tickets);
    const slaRows = this.computeSlaCompliance(tickets, slaThresholdMinutes, 'day');
    const abandonment = this.computeAbandonment(tickets);
    const throughputRows = this.computeThroughput(tickets, 'hour');
    const staffPerformance = this.computeStaffPerformance(tickets);

    return {
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      params: {
        volumeGranularity,
        slaThresholdMinutes,
      },
      queueVolume: queueVolumeRows,
      averageWaitTime: waitTimeRows,
      serviceDuration: serviceDurationRows,
      slaCompliance: slaRows,
      abandonment,
      throughput: throughputRows,
      staffPerformance,
    };
  }

  async exportReportCsv(input: {
    report:
      | 'queue-volume'
      | 'wait-times'
      | 'service-durations'
      | 'sla'
      | 'abandonment'
      | 'throughput'
      | 'staff-performance';
    branchId?: string;
    start?: string;
    end?: string;
    volumeGranularity?: 'hour' | 'day' | 'week';
    slaThresholdMinutes?: number;
  }) {
    const summary = await this.getSummary({
      branchId: input.branchId,
      start: input.start,
      end: input.end,
      volumeGranularity: input.volumeGranularity,
      slaThresholdMinutes: input.slaThresholdMinutes,
    });

    switch (input.report) {
      case 'queue-volume':
        return this.toCsv(summary.queueVolume);
      case 'wait-times':
        return this.toCsv(summary.averageWaitTime);
      case 'service-durations':
        return this.toCsv(summary.serviceDuration);
      case 'sla':
        return this.toCsv(summary.slaCompliance);
      case 'abandonment':
        return this.toCsv([
          { metric: 'totalCreated', value: summary.abandonment.totalCreated },
          { metric: 'cancelled', value: summary.abandonment.cancelled },
          { metric: 'noShow', value: summary.abandonment.noShow },
          { metric: 'cancelledRate', value: summary.abandonment.cancelledRate },
          { metric: 'noShowRate', value: summary.abandonment.noShowRate },
          { metric: 'p50TimeToAbandonMinutes', value: summary.abandonment.p50TimeToAbandonMinutes },
          { metric: 'p90TimeToAbandonMinutes', value: summary.abandonment.p90TimeToAbandonMinutes },
        ]);
      case 'throughput':
        return this.toCsv(summary.throughput);
      case 'staff-performance':
        return this.toCsv(summary.staffPerformance.staffRows);
      default:
        return '';
    }
  }

  private computeQueueVolume(
    tickets: Array<{
      createdAt: Date;
      channel: TicketChannel;
      branch: { id: string; name: string };
      service: { id: string; name: string } | null;
    }>,
    granularity: 'hour' | 'day' | 'week',
  ) {
    const map = new Map<string, { bucket: string; branchId: string; branchName: string; serviceId: string | null; serviceName: string | null; channel: TicketChannel; count: number }>();

    for (const t of tickets) {
      const bucket = this.bucketKey(t.createdAt, granularity);
      const serviceId = t.service?.id ?? null;
      const serviceName = t.service?.name ?? null;
      const key = [bucket, t.branch.id, serviceId ?? 'null', t.channel].join('|');
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          bucket,
          branchId: t.branch.id,
          branchName: t.branch.name,
          serviceId,
          serviceName,
          channel: t.channel,
          count: 1,
        });
      }
    }

    return [...map.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
  }

  private computeWaitTimes(
    tickets: Array<{
      status: TicketStatus;
      createdAt: Date;
      calledAt: Date | null;
      branch: { id: string; name: string };
      service: { id: string; name: string } | null;
      calledByStaff: { id: string; email: string } | null;
    }>,
  ) {
    const groups = new Map<string, { groupType: 'branch' | 'service' | 'staff'; groupId: string; groupLabel: string; waitMinutes: number[] }>();

    for (const t of tickets) {
      if (!t.calledAt) continue;
      const wait = (t.calledAt.getTime() - t.createdAt.getTime()) / 1000 / 60;
      if (!Number.isFinite(wait) || wait < 0) continue;

      const branchKey = `branch|${t.branch.id}`;
      const serviceKey = t.service ? `service|${t.service.id}` : null;
      const staffKey = t.calledByStaff ? `staff|${t.calledByStaff.id}` : null;

      const push = (key: string, groupType: 'branch' | 'service' | 'staff', groupId: string, groupLabel: string) => {
        const g = groups.get(key);
        if (g) g.waitMinutes.push(wait);
        else groups.set(key, { groupType, groupId, groupLabel, waitMinutes: [wait] });
      };

      push(branchKey, 'branch', t.branch.id, t.branch.name);
      if (serviceKey) push(serviceKey, 'service', t.service!.id, t.service!.name);
      if (staffKey) push(staffKey, 'staff', t.calledByStaff!.id, t.calledByStaff!.email);
    }

    const rows = [...groups.values()].map((g) => {
      const sorted = [...g.waitMinutes].sort((a, b) => a - b);
      const mean = sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length);
      return {
        groupType: g.groupType,
        groupId: g.groupId,
        groupLabel: g.groupLabel,
        samples: sorted.length,
        meanMinutes: Math.round(mean * 10) / 10,
        medianMinutes: Math.round(this.quantile(sorted, 0.5) * 10) / 10,
        p90Minutes: Math.round(this.quantile(sorted, 0.9) * 10) / 10,
      };
    });

    return rows.sort((a, b) => a.groupType.localeCompare(b.groupType) || a.groupLabel.localeCompare(b.groupLabel));
  }

  private computeServiceDurations(
    tickets: Array<{
      status: TicketStatus;
      calledAt: Date | null;
      completedAt: Date | null;
      service: { id: string; name: string } | null;
      completedByStaff: { id: string; email: string } | null;
    }>,
  ) {
    const groups = new Map<string, { groupType: 'service' | 'staff'; groupId: string; groupLabel: string; minutes: number[] }>();

    for (const t of tickets) {
      if (t.status !== TicketStatus.COMPLETED) continue;
      if (!t.calledAt || !t.completedAt) continue;
      const minutes = (t.completedAt.getTime() - t.calledAt.getTime()) / 1000 / 60;
      if (!Number.isFinite(minutes) || minutes < 0) continue;

      const push = (key: string, groupType: 'service' | 'staff', groupId: string, groupLabel: string) => {
        const g = groups.get(key);
        if (g) g.minutes.push(minutes);
        else groups.set(key, { groupType, groupId, groupLabel, minutes: [minutes] });
      };

      if (t.service) push(`service|${t.service.id}`, 'service', t.service.id, t.service.name);
      if (t.completedByStaff) push(`staff|${t.completedByStaff.id}`, 'staff', t.completedByStaff.id, t.completedByStaff.email);
    }

    return [...groups.values()].map((g) => {
      const sorted = [...g.minutes].sort((a, b) => a - b);
      const mean = sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length);
      return {
        groupType: g.groupType,
        groupId: g.groupId,
        groupLabel: g.groupLabel,
        samples: sorted.length,
        meanMinutes: Math.round(mean * 10) / 10,
        medianMinutes: Math.round(this.quantile(sorted, 0.5) * 10) / 10,
        p90Minutes: Math.round(this.quantile(sorted, 0.9) * 10) / 10,
      };
    }).sort((a, b) => a.groupType.localeCompare(b.groupType) || a.groupLabel.localeCompare(b.groupLabel));
  }

  private computeSlaCompliance(
    tickets: Array<{
      calledAt: Date | null;
      createdAt: Date;
      status: TicketStatus;
      branch: { id: string; name: string };
      service: { id: string; name: string } | null;
    }>,
    thresholdMinutes: number,
    bucket: 'day' | 'week' | 'hour',
  ) {
    const map = new Map<string, { bucket: string; branchId: string; branchName: string; serviceId: string | null; serviceName: string | null; served: number; withinSla: number }>();
    for (const t of tickets) {
      if (!t.calledAt) continue;
      const wait = (t.calledAt.getTime() - t.createdAt.getTime()) / 1000 / 60;
      if (!Number.isFinite(wait) || wait < 0) continue;

      const bucketKey = this.bucketKey(t.createdAt, bucket);
      const serviceId = t.service?.id ?? null;
      const serviceName = t.service?.name ?? null;
      const key = [bucketKey, t.branch.id, serviceId ?? 'null'].join('|');
      const row = map.get(key) ?? {
        bucket: bucketKey,
        branchId: t.branch.id,
        branchName: t.branch.name,
        serviceId,
        serviceName,
        served: 0,
        withinSla: 0,
      };
      row.served += 1;
      if (wait <= thresholdMinutes) row.withinSla += 1;
      map.set(key, row);
    }

    return [...map.values()]
      .map((r) => ({
        ...r,
        thresholdMinutes,
        slaPercent: r.served === 0 ? 0 : Math.round((r.withinSla / r.served) * 1000) / 10,
      }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));
  }

  private computeAbandonment(
    tickets: Array<{
      createdAt: Date;
      status: TicketStatus;
      cancelledAt: Date | null;
      cancelReason: TicketCancelReason | null;
    }>,
  ) {
    const totalCreated = tickets.length;
    const cancelled = tickets.filter((t) => t.status === TicketStatus.CANCELLED).length;
    const noShow = tickets.filter((t) => t.status === TicketStatus.CANCELLED && t.cancelReason === TicketCancelReason.NO_SHOW).length;

    const timeToAbandon: number[] = [];
    for (const t of tickets) {
      if (t.status !== TicketStatus.CANCELLED) continue;
      if (!t.cancelledAt) continue;
      const minutes = (t.cancelledAt.getTime() - t.createdAt.getTime()) / 1000 / 60;
      if (Number.isFinite(minutes) && minutes >= 0) timeToAbandon.push(minutes);
    }
    timeToAbandon.sort((a, b) => a - b);

    return {
      totalCreated,
      cancelled,
      noShow,
      cancelledRate: totalCreated === 0 ? 0 : Math.round((cancelled / totalCreated) * 1000) / 10,
      noShowRate: totalCreated === 0 ? 0 : Math.round((noShow / totalCreated) * 1000) / 10,
      p50TimeToAbandonMinutes: Math.round(this.quantile(timeToAbandon, 0.5) * 10) / 10,
      p90TimeToAbandonMinutes: Math.round(this.quantile(timeToAbandon, 0.9) * 10) / 10,
    };
  }

  private computeThroughput(
    tickets: Array<{
      status: TicketStatus;
      completedAt: Date | null;
      completedByStaff: { id: string } | null;
      branch: { id: string; name: string };
      service: { id: string; name: string } | null;
    }>,
    granularity: 'hour' | 'day' | 'week',
  ) {
    const map = new Map<string, { bucket: string; branchId: string; branchName: string; serviceId: string | null; serviceName: string | null; completed: number; activeStaff: Set<string> }>();
    for (const t of tickets) {
      if (t.status !== TicketStatus.COMPLETED) continue;
      if (!t.completedAt) continue;
      const bucket = this.bucketKey(t.completedAt, granularity);
      const serviceId = t.service?.id ?? null;
      const serviceName = t.service?.name ?? null;
      const key = [bucket, t.branch.id, serviceId ?? 'null'].join('|');
      const row =
        map.get(key) ??
        {
          bucket,
          branchId: t.branch.id,
          branchName: t.branch.name,
          serviceId,
          serviceName,
          completed: 0,
          activeStaff: new Set<string>(),
        };
      row.completed += 1;
      if (t.completedByStaff?.id) row.activeStaff.add(t.completedByStaff.id);
      map.set(key, row);
    }

    return [...map.values()]
      .map((r) => ({
        bucket: r.bucket,
        branchId: r.branchId,
        branchName: r.branchName,
        serviceId: r.serviceId,
        serviceName: r.serviceName,
        completed: r.completed,
        activeStaff: r.activeStaff.size,
        completedPerActiveStaff: r.activeStaff.size === 0 ? 0 : Math.round((r.completed / r.activeStaff.size) * 100) / 100,
      }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));
  }

  private computeStaffPerformance(
    tickets: Array<{
      status: TicketStatus;
      calledAt: Date | null;
      completedAt: Date | null;
      calledByStaff: { id: string; email: string } | null;
      completedByStaff: { id: string; email: string } | null;
    }>,
  ) {
    const byStaff = new Map<string, { staffId: string; staffEmail: string; handleMinutes: number[]; callEvents: Array<{ calledAt: Date; completedAt: Date | null }> }>();
    for (const t of tickets) {
      if (!t.calledByStaff) continue;
      const staffId = t.calledByStaff.id;
      const staffEmail = t.calledByStaff.email;
      const row = byStaff.get(staffId) ?? { staffId, staffEmail, handleMinutes: [], callEvents: [] };
      row.callEvents.push({ calledAt: t.calledAt ?? new Date(0), completedAt: t.completedAt });
      if (t.status === TicketStatus.COMPLETED && t.calledAt && t.completedAt) {
        const minutes = (t.completedAt.getTime() - t.calledAt.getTime()) / 1000 / 60;
        if (Number.isFinite(minutes) && minutes >= 0) row.handleMinutes.push(minutes);
      }
      byStaff.set(staffId, row);
    }

    const staffRows = [...byStaff.values()].map((s) => {
      const sortedHandle = [...s.handleMinutes].sort((a, b) => a - b);
      const meanHandle =
        sortedHandle.reduce((a, b) => a + b, 0) / Math.max(1, sortedHandle.length);

      // Idle time between completing one ticket and calling the next.
      const events = s.callEvents
        .filter((e) => e.calledAt.getTime() > 0)
        .sort((a, b) => a.calledAt.getTime() - b.calledAt.getTime());
      const idleMinutes: number[] = [];
      for (let i = 1; i < events.length; i++) {
        const prev = events[i - 1];
        const cur = events[i];
        if (!prev.completedAt) continue;
        const mins = (cur.calledAt.getTime() - prev.completedAt.getTime()) / 1000 / 60;
        if (Number.isFinite(mins) && mins >= 0) idleMinutes.push(mins);
      }
      idleMinutes.sort((a, b) => a - b);

      return {
        staffId: s.staffId,
        staffEmail: s.staffEmail,
        ticketsCalled: events.length,
        ticketsCompleted: sortedHandle.length,
        meanHandleMinutes: Math.round(meanHandle * 10) / 10,
        medianHandleMinutes: Math.round(this.quantile(sortedHandle, 0.5) * 10) / 10,
        p90HandleMinutes: Math.round(this.quantile(sortedHandle, 0.9) * 10) / 10,
        meanIdleMinutes:
          idleMinutes.length === 0
            ? 0
            : Math.round((idleMinutes.reduce((a, b) => a + b, 0) / idleMinutes.length) * 10) / 10,
        medianIdleMinutes: Math.round(this.quantile(idleMinutes, 0.5) * 10) / 10,
      };
    }).sort((a, b) => b.ticketsCompleted - a.ticketsCompleted);

    const counts = staffRows.map((r) => r.ticketsCompleted).sort((a, b) => a - b);
    const n = counts.length;
    const sum = counts.reduce((a, b) => a + b, 0);
    const gini =
      n <= 1 || sum === 0
        ? 0
        : (counts.reduce((acc, x, i) => acc + (2 * (i + 1) - n - 1) * x, 0) / (n * sum));

    return {
      giniWorkload: Math.round(gini * 1000) / 1000,
      staffRows,
    };
  }
}
