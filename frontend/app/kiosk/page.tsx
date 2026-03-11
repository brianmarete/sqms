'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { queueApi, servicesApi, type Service, JoinQueueResponse } from '@/lib/api';
import { Loader2, CheckCircle2 } from 'lucide-react';

// Default branch ID - in production, this would come from URL params or config
const DEFAULT_BRANCH_ID = 'default-branch';

export default function KioskPage() {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<JoinQueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadServices = async () => {
    try {
      const list = await servicesApi.listForBranch(DEFAULT_BRANCH_ID, true);
      setServices(list);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load services.');
    }
  };

  useEffect(() => {
    void loadServices();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await queueApi.joinQueue({
        customerName,
        phone,
        serviceId,
        branchId: DEFAULT_BRANCH_ID,
        channel: 'KIOSK',
      });
      setTicket(result);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to join queue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTicket(null);
    setCustomerName('');
    setPhone('');
    setServiceId('');
    setError(null);
  };

  if (ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Ticket Confirmed!</CardTitle>
            <CardDescription>You have been added to the queue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-indigo-600">{ticket.ticketNo}</div>
              <p className="text-sm text-muted-foreground">Your Ticket Number</p>
            </div>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Position in Queue:</span>
                <span className="font-semibold">{ticket.position}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Estimated Wait Time:</span>
                <span className="font-semibold">{ticket.estimatedWaitTime} minutes</span>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <p className="text-sm text-blue-900">
                You will receive an SMS confirmation shortly. Please wait for your ticket to be
                called.
              </p>
            </div>
            <Button onClick={handleReset} className="w-full" variant="outline">
              Join Another Queue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Join Queue</CardTitle>
          <CardDescription>Enter your details to join the queue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+2547XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service">Service Type</Label>
              <Select value={serviceId} onValueChange={setServiceId} disabled={loading}>
                <SelectTrigger id="service">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !serviceId}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining Queue...
                </>
              ) : (
                'Join Queue'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

