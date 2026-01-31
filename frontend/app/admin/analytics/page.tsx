'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, Loader2, RefreshCw, ShieldAlert, LogOut, ArrowLeft } from 'lucide-react';
import { analyticsApi, authApi, type DailyAnalyticsStats, type StaffUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

function SimpleLineChart({
  data,
  series,
}: {
  data: Array<{ x: string } & { [key: string]: number | string }>;
  series: Array<{ key: string; label: string; color: string }>;
}) {
  const width = 720;
  const height = 220;
  const paddingX = 32;
  const paddingY = 20;

  const maxY = useMemo(() => {
    const values: number[] = [];
    for (const row of data) {
      for (const s of series) {
        const v = row[s.key];
        values.push(typeof v === 'number' ? v : 0);
      }
    }
    return Math.max(1, ...values);
  }, [data, series]);

  const pointsFor = (key: string) => {
    const n = Math.max(1, data.length);
    return data
      .map((row, i) => {
        const x =
          n === 1
            ? width / 2
            : paddingX + (i * (width - paddingX * 2)) / (n - 1);
        const raw = row[key];
        const yValue = typeof raw === 'number' ? raw : 0;
        const y =
          height - paddingY - (yValue * (height - paddingY * 2)) / maxY;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
        role="img"
        aria-label="Trend chart"
      >
        {/* Axes */}
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="hsl(var(--border))" />
        <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} stroke="hsl(var(--border))" />

        {/* Grid */}
        {[0.25, 0.5, 0.75].map((p) => {
          const y = height - paddingY - p * (height - paddingY * 2);
          return (
            <line
              key={p}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="hsl(var(--border))"
              opacity={0.35}
            />
          );
        })}

        {series.map((s) => (
          <polyline
            key={s.key}
            points={pointsFor(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const todayIso = useMemo(() => isoDate(new Date()), []);

  const [user, setUser] = useState<StaffUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState('');
  const [date, setDate] = useState(todayIso);
  const [trendDays, setTrendDays] = useState<7 | 30>(7);

  const [daily, setDaily] = useState<DailyAnalyticsStats | null>(null);
  const [trend, setTrend] = useState<DailyAnalyticsStats[]>([]);
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

  const fetchAnalytics = useCallback(async () => {
    if (!branchId || !date) return;
    setLoading(true);
    setError(null);
    try {
      const [dailyStats, trendStats] = await Promise.all([
        analyticsApi.getDailyStats(branchId, date),
        (async () => {
          const dates = buildDateRange(date, trendDays);
          const results = await Promise.all(dates.map((d) => analyticsApi.getDailyStats(branchId, d)));
          return results.sort((a, b) => a.date.localeCompare(b.date));
        })(),
      ]);
      setDaily(dailyStats);
      setTrend(trendStats);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load analytics');
      setDaily(null);
      setTrend([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, date, trendDays]);

  useEffect(() => {
    if (!canView) return;
    if (!branchId) return;
    fetchAnalytics();
  }, [canView, branchId, date, trendDays, fetchAnalytics]);

  const trendChartData = useMemo(() => {
    return trend.map((d) => ({
      x: d.date,
      total: d.total,
      completed: d.completed,
      cancelled: d.cancelled,
    }));
  }, [trend]);

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
              Choose a branch and a date. Trend chart shows the last {trendDays} days ending on the selected date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="branchId">Branch ID</Label>
                <Input
                  id="branchId"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  placeholder="e.g. default-branch"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trend">Trend window</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={trendDays === 7 ? 'default' : 'outline'}
                    onClick={() => setTrendDays(7)}
                    className="flex-1"
                  >
                    7 days
                  </Button>
                  <Button
                    type="button"
                    variant={trendDays === 30 ? 'default' : 'outline'}
                    onClick={() => setTrendDays(30)}
                    className="flex-1"
                  >
                    30 days
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button
                  type="button"
                  onClick={fetchAnalytics}
                  disabled={loading || !branchId || !date}
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
              <CardTitle>Total tickets</CardTitle>
              <CardDescription>{daily?.date ?? '—'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{daily?.total ?? '—'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Completed</CardTitle>
              <CardDescription>Tickets served</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{daily?.completed ?? '—'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Avg wait time</CardTitle>
              <CardDescription>Created → Called</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {daily ? formatMinutes(daily.averageWaitTime) : '—'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Avg service time</CardTitle>
              <CardDescription>Called → Completed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {daily ? formatMinutes(daily.averageServiceTime) : '—'}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Trend</CardTitle>
              <CardDescription>Daily totals over the last {trendDays} days</CardDescription>
            </CardHeader>
            <CardContent>
              {trend.length === 0 ? (
                <div className="text-sm text-muted-foreground">No data.</div>
              ) : (
                <SimpleLineChart
                  data={trendChartData}
                  series={[
                    { key: 'total', label: 'Total', color: 'hsl(var(--primary))' },
                    { key: 'completed', label: 'Completed', color: 'hsl(142.1 76.2% 36.3%)' },
                    { key: 'cancelled', label: 'Cancelled', color: 'hsl(var(--destructive))' },
                  ]}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status breakdown</CardTitle>
              <CardDescription>{daily?.date ?? '—'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Waiting</span>
                <span className="font-semibold">{daily?.waiting ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Serving</span>
                <span className="font-semibold">{daily?.serving ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Completed</span>
                <span className="font-semibold">{daily?.completed ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cancelled</span>
                <span className="font-semibold">{daily?.cancelled ?? '—'}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daily table</CardTitle>
            <CardDescription>Raw daily stats for the trend window</CardDescription>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <div className="text-sm text-muted-foreground">No data.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Total</th>
                      <th className="py-2 pr-4 font-medium">Completed</th>
                      <th className="py-2 pr-4 font-medium">Cancelled</th>
                      <th className="py-2 pr-4 font-medium">Avg wait</th>
                      <th className="py-2 pr-4 font-medium">Avg service</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.map((d) => (
                      <tr key={d.date} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 font-medium">{d.date}</td>
                        <td className="py-2 pr-4">{d.total}</td>
                        <td className="py-2 pr-4">{d.completed}</td>
                        <td className="py-2 pr-4">{d.cancelled}</td>
                        <td className="py-2 pr-4">{formatMinutes(d.averageWaitTime)}</td>
                        <td className="py-2 pr-4">{formatMinutes(d.averageServiceTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

