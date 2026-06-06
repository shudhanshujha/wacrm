'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Broadcast } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, Radio, FileText } from 'lucide-react';
import { getBroadcastStatus } from '@/lib/broadcast-status';

function RateCell({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  color: string;
}) {
  const rate = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${color}`}
          style={{ width: `${rate}%` }}
        />
      </div>
      <span className="text-xs font-medium text-foreground tabular-nums">
        {rate}%
      </span>
    </div>
  );
}

export default function BroadcastsContent() {
  const router = useRouter();
  const supabase = createClient();

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBroadcasts = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('broadcasts')
      .select('*')
      .order('created_at', { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setBroadcasts(data ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    setTimeout(() => {
      fetchBroadcasts();
    }, 0);
  }, [fetchBroadcasts]);

  const anySending = useMemo(() => {
    return broadcasts.some((b) => b.status === 'sending');
  }, [broadcasts]);

  if (loading && broadcasts.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center p-8">
        <p className="text-sm text-red-400 font-medium">Error loading broadcasts</p>
        <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {anySending && (
        <div
          role="progressbar"
          aria-label="Broadcast in progress"
          className="broadcast-indeterminate fixed inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-muted"
        >
          <div className="broadcast-indeterminate-bar h-0.5 bg-primary" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Broadcasts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Send bulk messages to your contacts using approved templates.
          </p>
        </div>
        <Button
          onClick={() => router.push('/broadcasts/new')}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Broadcast
        </Button>
      </div>

      {broadcasts.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-border bg-card/30">
          <Radio className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">No broadcasts yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Reach your contacts at scale with bulk messaging.
          </p>
          <Button
            onClick={() => router.push('/broadcasts/new')}
            className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Broadcast
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card/30">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Broadcast</TableHead>
                <TableHead className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">Audience</TableHead>
                <TableHead className="hidden text-muted-foreground lg:table-cell">Delivery</TableHead>
                <TableHead className="hidden text-muted-foreground lg:table-cell">Read</TableHead>
                <TableHead className="hidden text-muted-foreground xl:table-cell">Clicked</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="hidden text-muted-foreground md:table-cell text-center">A/B</TableHead>
                <TableHead className="hidden text-muted-foreground md:table-cell">Scheduled For</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcasts.map((broadcast) => {
                const status = getBroadcastStatus(broadcast.status);
                return (
                  <TableRow
                    key={broadcast.id}
                    className="cursor-pointer border-border hover:bg-accent/30 transition-colors"
                    onClick={() => router.push(`/broadcasts/${broadcast.id}`)}
                  >
                    <TableCell>
                      <div className="flex flex-col min-w-0">
                        <span className="text-foreground font-semibold truncate">
                          {broadcast.name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <FileText className="size-3" />
                            {broadcast.template_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground/30">•</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {new Date(broadcast.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell font-mono text-xs">
                      {broadcast.total_recipients}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <RateCell
                        value={broadcast.delivered_count}
                        total={broadcast.total_recipients}
                        color="bg-primary"
                      />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <RateCell
                        value={broadcast.read_count}
                        total={broadcast.total_recipients}
                        color="bg-blue-500"
                      />
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <RateCell
                        value={broadcast.clicked_count ?? 0}
                        total={broadcast.total_recipients}
                        color="bg-purple-500"
                      />
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight ${status.classes}`}
                      >
                        {status.pulse && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yellow-400" />
                          </span>
                        )}
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell text-center">
                      {broadcast.ab_variant === 'A' && (
                        <span className="inline-flex items-center rounded-full border border-violet-800 bg-violet-900/40 px-2 py-0.5 text-[9px] font-bold text-violet-300 uppercase">
                          A
                        </span>
                      )}
                      {broadcast.ab_variant === 'B' && (
                        <span className="inline-flex items-center rounded-full border border-fuchsia-800 bg-fuchsia-900/40 px-2 py-0.5 text-[9px] font-bold text-fuchsia-300 uppercase">
                          B
                        </span>
                      )}
                      {!broadcast.ab_variant && <span className="text-muted-foreground/20 text-xs">—</span>}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell text-[11px] tabular-nums">
                      {broadcast.scheduled_at ? new Date(broadcast.scheduled_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
