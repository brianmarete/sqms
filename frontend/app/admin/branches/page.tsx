'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
import {
  adminBranchesApi,
  adminServicesApi,
  servicesApi,
  type Branch,
  type Service,
} from '@/lib/api';
import { Loader2 } from 'lucide-react';

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [services, setServices] = useState<Service[]>([]);

  const [newBranchName, setNewBranchName] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCounter, setNewServiceCounter] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refreshBranches = useCallback(async () => {
    const list = await adminBranchesApi.list();
    setBranches(list);
    if (!selectedBranchId && list.length > 0) setSelectedBranchId(list[0].id);
  }, [selectedBranchId]);

  const refreshServices = useCallback(async () => {
    if (!selectedBranchId) {
      setServices([]);
      return;
    }
    const list = await servicesApi.listForBranch(selectedBranchId, false);
    setServices(list);
  }, [selectedBranchId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await refreshBranches();
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.message || 'Failed to load branches');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshServices();
  }, [selectedBranchId]);

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) || null,
    [branches, selectedBranchId],
  );

  const createBranch = async () => {
    setBusy('create-branch');
    setError(null);
    try {
      const b = await adminBranchesApi.create(newBranchName.trim());
      setNewBranchName('');
      await refreshBranches();
      setSelectedBranchId(b.id);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create branch');
    } finally {
      setBusy(null);
    }
  };

  const deleteBranch = async (branchId: string) => {
    if (!confirm('Delete this branch? This will also delete its services, tickets, and staff.')) return;
    setBusy(`delete-branch:${branchId}`);
    setError(null);
    try {
      await adminBranchesApi.remove(branchId);
      await refreshBranches();
      await refreshServices();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete branch');
    } finally {
      setBusy(null);
    }
  };

  const createService = async () => {
    if (!selectedBranchId) return;
    setBusy('create-service');
    setError(null);
    try {
      await adminServicesApi.create(selectedBranchId, {
        name: newServiceName.trim(),
        counterLabel: newServiceCounter.trim() || undefined,
        isActive: true,
      });
      setNewServiceName('');
      setNewServiceCounter('');
      await refreshServices();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create service');
    } finally {
      setBusy(null);
    }
  };

  const toggleServiceActive = async (s: Service) => {
    if (!selectedBranchId) return;
    setBusy(`toggle-service:${s.id}`);
    setError(null);
    try {
      await adminServicesApi.update(selectedBranchId, s.id, { isActive: !s.isActive });
      await refreshServices();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update service');
    } finally {
      setBusy(null);
    }
  };

  const deleteService = async (serviceId: string) => {
    if (!selectedBranchId) return;
    if (!confirm('Delete this service?')) return;
    setBusy(`delete-service:${serviceId}`);
    setError(null);
    try {
      await adminServicesApi.remove(selectedBranchId, serviceId);
      await refreshServices();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete service');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold">Branches & Services</h1>
            <p className="text-muted-foreground">Services represent counters/desks within a branch.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin">Admin</Link>
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Branch</CardTitle>
            <CardDescription>Select an existing branch or create a new one.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Selected branch</Label>
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBranch && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => deleteBranch(selectedBranch.id)}
                    disabled={busy !== null}
                  >
                    Delete branch
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newBranch">New branch name</Label>
              <Input
                id="newBranch"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="e.g. Downtown Branch"
              />
              <Button
                type="button"
                onClick={createBranch}
                disabled={!newBranchName.trim() || busy !== null}
              >
                Create branch
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Services (Counters)</CardTitle>
            <CardDescription>
              Manage services for: <span className="font-medium">{selectedBranch?.name ?? '—'}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="serviceName">Service name</Label>
                <Input
                  id="serviceName"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="e.g. Loans"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="counterLabel">Counter label</Label>
                <Input
                  id="counterLabel"
                  value={newServiceCounter}
                  onChange={(e) => setNewServiceCounter(e.target.value)}
                  placeholder="e.g. Counter 4"
                />
              </div>
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button
                  type="button"
                  onClick={createService}
                  disabled={!selectedBranchId || !newServiceName.trim() || busy !== null}
                  className="w-full"
                >
                  Add service
                </Button>
              </div>
            </div>

            {services.length === 0 ? (
              <div className="text-sm text-muted-foreground">No services.</div>
            ) : (
              <div className="space-y-2">
                {services.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-semibold">
                        {s.name}{' '}
                        <span className="text-muted-foreground font-normal">
                          {s.counterLabel ? `• ${s.counterLabel}` : ''}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.id} • {s.isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => toggleServiceActive(s)}
                        disabled={busy !== null}
                      >
                        {s.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => deleteService(s.id)}
                        disabled={busy !== null}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

