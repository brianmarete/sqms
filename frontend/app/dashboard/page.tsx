'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { authApi, queueApi, servicesApi, type Service, type StaffUser, Ticket } from '@/lib/api';
import { useSocket } from '@/hooks/use-socket';
import { Loader2, Phone, CheckCircle2, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Default branch ID - in production, this would come from auth or config
const DEFAULT_BRANCH_ID = 'default-branch';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [branchId, setBranchId] = useState(DEFAULT_BRANCH_ID);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [currentServing, setCurrentServing] = useState<Ticket | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const [active, serving] = await Promise.all([
        queueApi.getActiveQueue(branchId, serviceId),
        queueApi.getCurrentServing(branchId, serviceId),
      ]);
      setTickets(active);
      setCurrentServing(serving);
    } catch (error) {
      console.error('Failed to fetch queue:', error);
    } finally {
      setLoading(false);
    }
  }, [branchId, serviceId]);

  // Set up WebSocket connection
  useSocket(branchId, serviceId, fetchQueue);

  // Initial fetch
  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Load user (branch + role)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await authApi.me();
        if (cancelled) return;
        setUser(user);
        setBranchId(user.branchId || DEFAULT_BRANCH_ID);
        setServiceId(user.serviceId ?? null);
      } catch (e) {
        // If this fails, middleware should already redirect to login; keep fallback behavior.
        console.error('Failed to load user session:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!branchId) return;
        const list = await servicesApi.listForBranch(branchId, true);
        if (cancelled) return;
        setServices(list);
        if (!serviceId && list.length > 0) setServiceId(list[0].id);
      } catch (e) {
        console.error('Failed to load services:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId, serviceId]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      router.replace('/login');
    }
  };

  const handleCallNext = async () => {
    setProcessing('call-next');
    try {
      const ticket = await queueApi.callNext(branchId, serviceId);
      setCurrentServing(ticket);
      await fetchQueue();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to call next customer');
    } finally {
      setProcessing(null);
    }
  };

  const handleComplete = async (ticketId: string) => {
    setProcessing(ticketId);
    try {
      await queueApi.completeTicket(ticketId);
      setCurrentServing(null);
      await fetchQueue();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to complete ticket');
    } finally {
      setProcessing(null);
    }
  };

  const handleNoShow = async (ticketId: string) => {
    setProcessing(ticketId);
    try {
      await queueApi.cancelTicket(ticketId, 'no-show');
      if (currentServing?.id === ticketId) {
        setCurrentServing(null);
      }
      await fetchQueue();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to mark as no-show');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: Ticket['status']) => {
    const variants = {
      WAITING: 'default',
      SERVING: 'default',
      COMPLETED: 'secondary',
      CANCELLED: 'destructive',
    } as const;

    const icons = {
      WAITING: <Clock className="w-3 h-3 mr-1" />,
      SERVING: <Phone className="w-3 h-3 mr-1" />,
      COMPLETED: <CheckCircle2 className="w-3 h-3 mr-1" />,
      CANCELLED: <XCircle className="w-3 h-3 mr-1" />,
    };

    return (
      <Badge variant={variants[status]}>
        {icons[status]}
        {status}
      </Badge>
    );
  };

  const waitingTickets = tickets.filter((t) => t.status === 'WAITING');
  const servingTickets = tickets.filter((t) => t.status === 'SERVING');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold">Queue Management Dashboard</h1>
            <p className="text-muted-foreground">Manage your customer queue in real-time</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="min-w-[220px]">
              <Select
                value={serviceId ?? ''}
                onValueChange={(v) => setServiceId(v)}
                disabled={processing !== null || services.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service counter" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.counterLabel ? ` — ${s.counterLabel}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {user?.role === 'ADMIN' && (
              <Button asChild variant="outline">
                <Link href="/admin/analytics">Analytics</Link>
              </Button>
            )}
            <Button onClick={handleLogout} variant="outline">
              Logout
            </Button>
            <Button
              onClick={handleCallNext}
              disabled={loading || processing !== null || waitingTickets.length === 0 || !serviceId}
              size="lg"
            >
              {processing === 'call-next' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calling...
                </>
              ) : (
                <>
                  <Phone className="mr-2 h-4 w-4" />
                  Call Next
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Currently Serving */}
        {currentServing && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Currently Serving</span>
                {getStatusBadge(currentServing.status)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Ticket Number</p>
                    <p className="text-2xl font-bold">{currentServing.ticketNo}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <p className="text-lg font-semibold">
                      {currentServing.customerName || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="text-lg">{currentServing.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Service</p>
                    <p className="text-lg">{currentServing.serviceType}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleComplete(currentServing.id)}
                    disabled={processing !== null}
                    className="flex-1"
                  >
                    {processing === currentServing.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Complete
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => handleNoShow(currentServing.id)}
                    disabled={processing !== null}
                    variant="destructive"
                    className="flex-1"
                  >
                    {processing === currentServing.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-2 h-4 w-4" />
                        No Show
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Waiting Queue */}
        <Card>
          <CardHeader>
            <CardTitle>Waiting Queue ({waitingTickets.length})</CardTitle>
            <CardDescription>
              Customers waiting to be served, sorted by arrival time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : waitingTickets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No customers in the queue
              </div>
            ) : (
              <div className="space-y-2">
                {waitingTickets.map((ticket, index) => (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{ticket.ticketNo}</p>
                          {getStatusBadge(ticket.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {ticket.customerName || 'N/A'} • {ticket.phone} • {ticket.serviceType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Joined:{' '}
                          {new Date(ticket.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently Completed */}
        {servingTickets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Serving ({servingTickets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {servingTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{ticket.ticketNo}</p>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {ticket.customerName || 'N/A'} • {ticket.serviceType}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleComplete(ticket.id)}
                        disabled={processing !== null}
                        size="sm"
                      >
                        Complete
                      </Button>
                      <Button
                        onClick={() => handleNoShow(ticket.id)}
                        disabled={processing !== null}
                        variant="destructive"
                        size="sm"
                      >
                        No Show
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

