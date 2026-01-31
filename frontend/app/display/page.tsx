'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSocket } from '@/hooks/use-socket';
import { queueApi, Ticket } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

// Default branch ID - in production, this would come from URL params or config
const DEFAULT_BRANCH_ID = 'default-branch';

export default function DisplayPage() {
  const [currentServing, setCurrentServing] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const fetchCurrentServing = useCallback(async () => {
    try {
      const serving = await queueApi.getCurrentServing(DEFAULT_BRANCH_ID);
      setCurrentServing(serving);
      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error('Failed to fetch current serving ticket:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTicketUpdate = useCallback((ticket: Ticket | null) => {
    setCurrentServing(ticket);
    setLastUpdatedAt(new Date());
    setLoading(false);
  }, []);

  // Live updates: when staff call/clear a ticket, update immediately
  useSocket(DEFAULT_BRANCH_ID, undefined, handleTicketUpdate);

  useEffect(() => {
    fetchCurrentServing();
  }, [fetchCurrentServing]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6">
      <Card className="w-full max-w-5xl bg-white/5 border-white/10">
        <CardContent className="p-10 md:p-14">
          <div className="text-center space-y-10">
            <div className="space-y-3">
              <p className="text-sm md:text-base tracking-widest text-white/70 uppercase">
                Now Serving
              </p>
              <div className="h-px bg-white/10 w-32 mx-auto" />
            </div>

            {loading ? (
              <div className="text-white/80 text-2xl md:text-3xl font-semibold">
                Loading…
              </div>
            ) : currentServing ? (
              <div className="space-y-8">
                <div className="text-7xl md:text-9xl font-black tracking-tight text-white">
                  {currentServing.ticketNo}
                </div>
                <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 text-white/80">
                  <div className="px-4 py-2 rounded-full bg-white/10 border border-white/10">
                    Service: <span className="font-semibold">{currentServing.serviceType}</span>
                  </div>
                  {currentServing.branch?.name && (
                    <div className="px-4 py-2 rounded-full bg-white/10 border border-white/10">
                      Branch: <span className="font-semibold">{currentServing.branch.name}</span>
                    </div>
                  )}
                </div>
                <p className="text-white/60">
                  Please proceed to the counter when your ticket is called.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-4xl md:text-5xl font-bold text-white">No ticket called</div>
                <p className="text-white/60">Please wait. The next ticket will appear here.</p>
              </div>
            )}

            <div className="text-xs text-white/40">
              Last updated: {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : '—'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

