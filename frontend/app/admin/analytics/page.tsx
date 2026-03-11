'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, Download, Loader2, RefreshCw, ShieldAlert, LogOut, ArrowLeft } from 'lucide-react';
import { adminBranchesApi, analyticsApi, authApi, type AnalyticsSummary, type Branch, type StaffUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function formatMinutes(value: number) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} min`;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function buildDateRange(endDateIso: string, days: number) {
  const end = new Date(endDateIso);
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(isoDate(addDays(end, -i)));
  return out;
}

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const todayIso = useMemo(() => isoDate(new Date()), []);

  const [user, setUser] = useState<StaffUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [preset, setPreset] = useState<'today' | 'last7' | 'last30' | 'custom'>('last7');
  const [start, setStart] = useState(buildDateRange(todayIso, 7)[0]);
  const [end, setEnd] = useState(todayIso);
  const [volumeGranularity, setVolumeGranularity] = useState<'hour' | 'day' | 'week'>('day');
  const [slaThresholdMinutes, setSlaThresholdMinutes] = useState(10);

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setAuthLoading(true);
        const { user } = await authApi.me();
        if (cancelled) return;
        setUser(user);
        setBranchId(user.branchId);
        setAuthError(null);
      } catch (e: any) {
        if (cancelled) return;
        setAuthError(e?.response?.data?.message || 'Failed to load session');
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canView = user?.role === 'ADMIN';

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await adminBranchesApi.list();
        if (cancelled) return;
        setBranches(list);
      } catch {
        // Non-fatal: admin can still type a branch ID if needed.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyticsApi.getSummary({
        branchId: branchId || undefined,
        start,
        end,
        volumeGranularity,
        slaThresholdMinutes,
      });
      setSummary(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load analytics');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [branchId, end, slaThresholdMinutes, start, volumeGranularity]);

  useEffect(() => {
    if (!canView) return;
    if (!start || !end) return;
    fetchAnalytics();
  }, [canView, fetchAnalytics, start, end]);

  useEffect(() => {
    if (preset === 'custom') return;
    if (preset === 'today') {
      setStart(todayIso);
      setEnd(todayIso);
      return;
    }
    if (preset === 'last7') {
      const dates = buildDateRange(todayIso, 7);
      setStart(dates[0]);
      setEnd(dates[dates.length - 1]);
      return;
    }
    const dates = buildDateRange(todayIso, 30);
    setStart(dates[0]);
    setEnd(dates[dates.length - 1]);
  }, [preset, todayIso]);

  const downloadCsv = async (report: Parameters<typeof analyticsApi.exportReportCsv>[0]['report']) => {
    const blob = await analyticsApi.exportReportCsv({
      report,
      branchId: branchId || undefined,
      start,
      end,
      volumeGranularity,
      slaThresholdMinutes,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sqms-${report}-${start}-to-${end}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      router.replace('/login');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                Session error
              </CardTitle>
              <CardDescription>{authError}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/login">Go to login</Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                Access denied
              </CardTitle>
              <CardDescription>This dashboard is only available to ADMIN users.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button asChild>
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
              <Button onClick={handleLogout} variant="outline">
                Logout
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-7 w-7 text-primary" />
              <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            </div>
            <p className="text-muted-foreground">
              Daily stats and trends for queue performance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Choose a branch and a time period. Reports below will update for the selected range.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="branchId">Branch</Label>
                <Select value={branchId} onValueChange={(value) => setBranchId(value)}>
                  <SelectTrigger id="branchId">
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                <Label htmlFor="preset">Time period</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={preset === 'today' ? 'default' : 'outline'} onClick={() => setPreset('today')} className="flex-1">
                    Today
                  </Button>
                  <Button type="button" variant={preset === 'last7' ? 'default' : 'outline'} onClick={() => setPreset('last7')} className="flex-1">
                    Last 7
                  </Button>
                  <Button type="button" variant={preset === 'last30' ? 'default' : 'outline'} onClick={() => setPreset('last30')} className="flex-1">
                    Last 30
                  </Button>
                  <Button type="button" variant={preset === 'custom' ? 'default' : 'outline'} onClick={() => setPreset('custom')} className="flex-1">
                    Custom
                  </Button>
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                <Label htmlFor="range">Date range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input id="start" type="date" value={start} onChange={(e) => { setPreset('custom'); setStart(e.target.value); }} />
                  <Input id="end" type="date" value={end} onChange={(e) => { setPreset('custom'); setEnd(e.target.value); }} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button
                  type="button"
                  onClick={fetchAnalytics}
                  disabled={loading || !start || !end}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="granularity">Queue volume granularity</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={volumeGranularity === 'hour' ? 'default' : 'outline'} onClick={() => setVolumeGranularity('hour')} className="flex-1">
                    Hour
                  </Button>
                  <Button type="button" variant={volumeGranularity === 'day' ? 'default' : 'outline'} onClick={() => setVolumeGranularity('day')} className="flex-1">
                    Day
                  </Button>
                  <Button type="button" variant={volumeGranularity === 'week' ? 'default' : 'outline'} onClick={() => setVolumeGranularity('week')} className="flex-1">
                    Week
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sla">SLA threshold (minutes)</Label>
                <Input
                  id="sla"
                  type="number"
                  min={1}
                  value={slaThresholdMinutes}
                  onChange={(e) => setSlaThresholdMinutes(Math.max(1, Number(e.target.value || 10)))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Failed to load analytics</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Created</CardTitle>
              <CardDescription>{summary ? `${start} → ${end}` : '—'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary?.abandonment.totalCreated ?? '—'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cancelled rate</CardTitle>
              <CardDescription>Includes no-shows</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary ? `${summary.abandonment.cancelledRate.toFixed(1)}%` : '—'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>No-show rate</CardTitle>
              <CardDescription>Marked as no-show</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary ? `${summary.abandonment.noShowRate.toFixed(1)}%` : '—'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Workload fairness</CardTitle>
              <CardDescription>Gini coefficient</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary ? summary.staffPerformance.giniWorkload : '—'}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Queue volume by time</CardTitle>
                <CardDescription>By {volumeGranularity}, service, channel</CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={() => downloadCsv('queue-volume')} disabled={!summary}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            </CardHeader>
            <CardContent>
              {!summary || summary.queueVolume.length === 0 ? (
                <div className="text-sm text-muted-foreground">No data.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-4 font-medium">Bucket</th>
                        <th className="py-2 pr-4 font-medium">Service</th>
                        <th className="py-2 pr-4 font-medium">Channel</th>
                        <th className="py-2 pr-4 font-medium">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.queueVolume.slice(0, 30).map((r) => (
                        <tr key={`${r.bucket}-${r.serviceId ?? 'none'}-${r.channel}`} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 font-medium">{r.bucket}</td>
                          <td className="py-2 pr-4">{r.serviceName ?? '—'}</td>
                          <td className="py-2 pr-4">{r.channel}</td>
                          <td className="py-2 pr-4">{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {summary.queueVolume.length > 30 && (
                    <div className="mt-2 text-xs text-muted-foreground">Showing first 30 rows. Download CSV for full report.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>SLA compliance</CardTitle>
                <CardDescription>Wait time ≤ {slaThresholdMinutes} minutes</CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={() => downloadCsv('sla')} disabled={!summary}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            </CardHeader>
            <CardContent>
              {!summary || summary.slaCompliance.length === 0 ? (
                <div className="text-sm text-muted-foreground">No data.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-4 font-medium">Bucket</th>
                        <th className="py-2 pr-4 font-medium">Service</th>
                        <th className="py-2 pr-4 font-medium">Served</th>
                        <th className="py-2 pr-4 font-medium">Within SLA</th>
                        <th className="py-2 pr-4 font-medium">SLA %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.slaCompliance.slice(0, 30).map((r) => (
                        <tr key={`${r.bucket}-${r.serviceId ?? 'none'}`} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 font-medium">{r.bucket}</td>
                          <td className="py-2 pr-4">{r.serviceName ?? '—'}</td>
                          <td className="py-2 pr-4">{r.served}</td>
                          <td className="py-2 pr-4">{r.withinSla}</td>
                          <td className="py-2 pr-4">{r.slaPercent.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {summary.slaCompliance.length > 30 && (
                    <div className="mt-2 text-xs text-muted-foreground">Showing first 30 rows. Download CSV for full report.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Average wait time</CardTitle>
                <CardDescription>Created → Called (mean/median/p90)</CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={() => downloadCsv('wait-times')} disabled={!summary}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            </CardHeader>
            <CardContent>
              {!summary || summary.averageWaitTime.length === 0 ? (
                <div className="text-sm text-muted-foreground">No data.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-4 font-medium">Group</th>
                        <th className="py-2 pr-4 font-medium">Label</th>
                        <th className="py-2 pr-4 font-medium">Samples</th>
                        <th className="py-2 pr-4 font-medium">Mean</th>
                        <th className="py-2 pr-4 font-medium">Median</th>
                        <th className="py-2 pr-4 font-medium">P90</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.averageWaitTime.slice(0, 30).map((r) => (
                        <tr key={`${r.groupType}-${r.groupId}`} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 font-medium">{r.groupType}</td>
                          <td className="py-2 pr-4">{r.groupLabel}</td>
                          <td className="py-2 pr-4">{r.samples}</td>
                          <td className="py-2 pr-4">{formatMinutes(r.meanMinutes)}</td>
                          <td className="py-2 pr-4">{formatMinutes(r.medianMinutes)}</td>
                          <td className="py-2 pr-4">{formatMinutes(r.p90Minutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {summary.averageWaitTime.length > 30 && (
                    <div className="mt-2 text-xs text-muted-foreground">Showing first 30 rows. Download CSV for full report.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Service duration</CardTitle>
                <CardDescription>Called → Completed (mean/median/p90)</CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={() => downloadCsv('service-durations')} disabled={!summary}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            </CardHeader>
            <CardContent>
              {!summary || summary.serviceDuration.length === 0 ? (
                <div className="text-sm text-muted-foreground">No data.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-4 font-medium">Group</th>
                        <th className="py-2 pr-4 font-medium">Label</th>
                        <th className="py-2 pr-4 font-medium">Samples</th>
                        <th className="py-2 pr-4 font-medium">Mean</th>
                        <th className="py-2 pr-4 font-medium">Median</th>
                        <th className="py-2 pr-4 font-medium">P90</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.serviceDuration.slice(0, 30).map((r) => (
                        <tr key={`${r.groupType}-${r.groupId}`} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 font-medium">{r.groupType}</td>
                          <td className="py-2 pr-4">{r.groupLabel}</td>
                          <td className="py-2 pr-4">{r.samples}</td>
                          <td className="py-2 pr-4">{formatMinutes(r.meanMinutes)}</td>
                          <td className="py-2 pr-4">{formatMinutes(r.medianMinutes)}</td>
                          <td className="py-2 pr-4">{formatMinutes(r.p90Minutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {summary.serviceDuration.length > 30 && (
                    <div className="mt-2 text-xs text-muted-foreground">Showing first 30 rows. Download CSV for full report.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Throughput & capacity</CardTitle>
                <CardDescription>Completed per hour vs active staff</CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={() => downloadCsv('throughput')} disabled={!summary}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            </CardHeader>
            <CardContent>
              {!summary || summary.throughput.length === 0 ? (
                <div className="text-sm text-muted-foreground">No data.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-4 font-medium">Hour</th>
                        <th className="py-2 pr-4 font-medium">Service</th>
                        <th className="py-2 pr-4 font-medium">Completed</th>
                        <th className="py-2 pr-4 font-medium">Active staff</th>
                        <th className="py-2 pr-4 font-medium">Per staff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.throughput.slice(0, 30).map((r) => (
                        <tr key={`${r.bucket}-${r.serviceId ?? 'none'}`} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 font-medium">{r.bucket}</td>
                          <td className="py-2 pr-4">{r.serviceName ?? '—'}</td>
                          <td className="py-2 pr-4">{r.completed}</td>
                          <td className="py-2 pr-4">{r.activeStaff}</td>
                          <td className="py-2 pr-4">{r.completedPerActiveStaff.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {summary.throughput.length > 30 && (
                    <div className="mt-2 text-xs text-muted-foreground">Showing first 30 rows. Download CSV for full report.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Staff performance & utilization</CardTitle>
                <CardDescription>Handle time + idle time + workload fairness</CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={() => downloadCsv('staff-performance')} disabled={!summary}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            </CardHeader>
            <CardContent>
              {!summary || summary.staffPerformance.staffRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">No data.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-4 font-medium">Staff</th>
                        <th className="py-2 pr-4 font-medium">Completed</th>
                        <th className="py-2 pr-4 font-medium">Mean handle</th>
                        <th className="py-2 pr-4 font-medium">P90 handle</th>
                        <th className="py-2 pr-4 font-medium">Mean idle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.staffPerformance.staffRows.slice(0, 30).map((r) => (
                        <tr key={r.staffId} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 font-medium">{r.staffEmail}</td>
                          <td className="py-2 pr-4">{r.ticketsCompleted}</td>
                          <td className="py-2 pr-4">{formatMinutes(r.meanHandleMinutes)}</td>
                          <td className="py-2 pr-4">{formatMinutes(r.p90HandleMinutes)}</td>
                          <td className="py-2 pr-4">{formatMinutes(r.meanIdleMinutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {summary.staffPerformance.staffRows.length > 30 && (
                    <div className="mt-2 text-xs text-muted-foreground">Showing first 30 rows. Download CSV for full report.</div>
                  )}
                </div>
              )}
              <div className="mt-3 text-xs text-muted-foreground">
                Fairness (Gini): {summary?.staffPerformance.giniWorkload ?? '—'} (0 = perfectly even, 1 = highly uneven)
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => downloadCsv('abandonment')} disabled={!summary}>
                  <Download className="mr-2 h-4 w-4" />
                  Abandonment CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

