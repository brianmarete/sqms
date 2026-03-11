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
  adminStaffApi,
  adminBranchesApi,
  servicesApi,
  type Branch,
  type Service,
  type Staff,
} from '@/lib/api';
import { Loader2, Trash2 } from 'lucide-react';

export default function AdminStaffPage() {
  const UNASSIGNED_SERVICE_VALUE = '__UNASSIGNED__';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [servicesByBranch, setServicesByBranch] = useState<Record<string, Service[]>>({});
  const [loadingServicesForBranch, setLoadingServicesForBranch] = useState<Record<string, boolean>>({});
  const [staff, setStaff] = useState<Staff[]>([]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'STAFF' | 'ADMIN'>('STAFF');
  const [branchId, setBranchId] = useState('');
  const [serviceId, setServiceId] = useState<string | null>(null);

  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    email: string;
    password: string;
    role: 'STAFF' | 'ADMIN';
    branchId: string;
    serviceId: string | null;
  } | null>(null);

  const refreshAll = useCallback(async () => {
    const [b, s] = await Promise.all([adminBranchesApi.list(), adminStaffApi.list()]);
    setBranches(b);
    setStaff(s);
    if (!branchId && b.length > 0) setBranchId(b[0].id);
  }, [branchId]);

  const ensureServicesLoaded = useCallback(async (targetBranchId: string) => {
    if (!targetBranchId) return;
    if (targetBranchId in servicesByBranch) return;
    if (loadingServicesForBranch[targetBranchId]) return;
    setLoadingServicesForBranch((prev) => ({ ...prev, [targetBranchId]: true }));
    try {
      const list = await servicesApi.listForBranch(targetBranchId, true);
      setServicesByBranch((prev) => ({ ...prev, [targetBranchId]: list }));
    } finally {
      setLoadingServicesForBranch((prev) => ({ ...prev, [targetBranchId]: false }));
    }
  }, [loadingServicesForBranch, servicesByBranch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await refreshAll();
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.message || 'Failed to load staff');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!branchId) return;
    void ensureServicesLoaded(branchId);
  }, [branchId]);

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === branchId) || null,
    [branches, branchId],
  );

  const servicesForCreate = useMemo(() => {
    if (!branchId) return [];
    return servicesByBranch[branchId] ?? [];
  }, [branchId, servicesByBranch]);

  const createStaff = async () => {
    setBusy('create');
    setError(null);
    try {
      await adminStaffApi.create({
        email: email.trim(),
        password,
        role,
        branchId,
        serviceId,
      });
      setEmail('');
      setPassword('');
      setRole('STAFF');
      setServiceId(null);
      await refreshAll();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create staff');
    } finally {
      setBusy(null);
    }
  };

  const removeStaff = async (staffId: string) => {
    if (!confirm('Delete this staff user?')) return;
    setBusy(`delete:${staffId}`);
    setError(null);
    try {
      await adminStaffApi.remove(staffId);
      await refreshAll();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to delete staff');
    } finally {
      setBusy(null);
    }
  };

  const startEdit = async (u: Staff) => {
    setEditingStaffId(u.id);
    setEditDraft({
      email: u.email,
      password: '',
      role: u.role,
      branchId: u.branchId,
      serviceId: u.serviceId ?? null,
    });
    await ensureServicesLoaded(u.branchId);
  };

  const cancelEdit = () => {
    setEditingStaffId(null);
    setEditDraft(null);
  };

  const saveEdit = async () => {
    if (!editingStaffId || !editDraft) return;
    if (!editDraft.email.trim()) {
      setError('Email is required');
      return;
    }
    if (!editDraft.branchId) {
      setError('Branch is required');
      return;
    }

    setBusy(`update:${editingStaffId}`);
    setError(null);
    try {
      await adminStaffApi.update(editingStaffId, {
        email: editDraft.email.trim(),
        role: editDraft.role,
        branchId: editDraft.branchId,
        serviceId: editDraft.serviceId,
        ...(editDraft.password ? { password: editDraft.password } : {}),
      });
      cancelEdit();
      await refreshAll();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update staff');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold">Staff</h1>
            <p className="text-muted-foreground">Create staff and allocate them to a branch + service counter.</p>
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
            <CardTitle>Create staff</CardTitle>
            <CardDescription>
              Allocate to: <span className="font-medium">{selectedBranch?.name ?? '—'}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@bank.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">STAFF</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Service counter</Label>
              <Select
                value={serviceId ?? UNASSIGNED_SERVICE_VALUE}
                onValueChange={(v) => setServiceId(v === UNASSIGNED_SERVICE_VALUE ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional (recommended)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_SERVICE_VALUE}>Unassigned</SelectItem>
                  {servicesForCreate.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.counterLabel ? ` — ${s.counterLabel}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button
                type="button"
                onClick={createStaff}
                disabled={busy !== null || !email.trim() || !password || !branchId}
                className="w-full"
              >
                Create
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Staff list</CardTitle>
            <CardDescription>Edit staff details and allocation (branch + optional service counter).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {staff.length === 0 ? (
              <div className="text-sm text-muted-foreground">No staff.</div>
            ) : (
              staff.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  {editingStaffId === u.id && editDraft ? (
                    <>
                      <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            value={editDraft.email}
                            onChange={(e) => setEditDraft((p) => (p ? { ...p, email: e.target.value } : p))}
                            placeholder="staff@bank.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Select
                            value={editDraft.role}
                            onValueChange={(v) => setEditDraft((p) => (p ? { ...p, role: v as any } : p))}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="STAFF">STAFF</SelectItem>
                              <SelectItem value="ADMIN">ADMIN</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Branch</Label>
                          <Select
                            value={editDraft.branchId}
                            onValueChange={async (v) => {
                              await ensureServicesLoaded(v);
                              setEditDraft((p) => {
                                if (!p) return p;
                                // Always clear service on branch change; backend enforces service/branch consistency.
                                return { ...p, branchId: v, serviceId: null };
                              });
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select branch" />
                            </SelectTrigger>
                            <SelectContent>
                              {branches.map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Service counter</Label>
                          <Select
                            value={editDraft.serviceId ?? UNASSIGNED_SERVICE_VALUE}
                            onValueChange={(v) =>
                              setEditDraft((p) => (p ? { ...p, serviceId: v === UNASSIGNED_SERVICE_VALUE ? null : v } : p))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Optional" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNASSIGNED_SERVICE_VALUE}>Unassigned</SelectItem>
                              {(servicesByBranch[editDraft.branchId] ?? []).map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                  {s.counterLabel ? ` — ${s.counterLabel}` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2 lg:col-span-4">
                          <Label>Reset password (optional)</Label>
                          <Input
                            value={editDraft.password}
                            onChange={(e) => setEditDraft((p) => (p ? { ...p, password: e.target.value } : p))}
                            type="password"
                            placeholder="Leave blank to keep unchanged"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 md:flex-row md:items-center">
                        <Button
                          type="button"
                          onClick={saveEdit}
                          disabled={busy !== null || !editDraft.email.trim() || !editDraft.branchId}
                        >
                          Save
                        </Button>
                        <Button type="button" variant="outline" onClick={cancelEdit} disabled={busy !== null}>
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => removeStaff(u.id)}
                          disabled={busy !== null}
                          className="flex items-center gap-2 md:ml-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="font-semibold">
                          {u.email}{' '}
                          <span className="text-muted-foreground font-normal">• {u.role}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Branch: {u.branch?.name ?? u.branchId}
                          {u.service ? ` • Service: ${u.service.name}` : ' • Service: —'}
                          {u.service?.counterLabel ? ` (${u.service.counterLabel})` : ''}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 md:flex-row md:items-center">
                        <Button type="button" variant="outline" onClick={() => void startEdit(u)} disabled={busy !== null}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => removeStaff(u.id)}
                          disabled={busy !== null}
                          className="flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

