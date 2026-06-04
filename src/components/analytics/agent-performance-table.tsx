'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Loader2 } from 'lucide-react';

interface AgentStat {
  agentId: string;
  agentName: string;
  conversationsHandled: number;
  resolvedCount: number;
  resolutionRate: number;
  avgResolutionMinutes: number | null;
}

export function AgentPerformanceTable() {
  const [agents, setAgents] = useState<AgentStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/agent-performance')
      .then((r) => r.json())
      .then((d) => {
        setAgents(d.agents ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Users className="h-5 w-5 text-primary" />
        <CardTitle className="text-base text-white">Agent Performance (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : agents.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No assigned conversations in the last 30 days.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Agent</TableHead>
                  <TableHead className="text-right text-slate-400">Handled</TableHead>
                  <TableHead className="text-right text-slate-400">Resolved</TableHead>
                  <TableHead className="text-right text-slate-400">Resolution Rate</TableHead>
                  <TableHead className="text-right text-slate-400">Avg. Resolution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.agentId} className="border-slate-800">
                    <TableCell className="font-medium text-white">
                      {agent.agentName}
                    </TableCell>
                    <TableCell className="text-right text-slate-300">
                      {agent.conversationsHandled}
                    </TableCell>
                    <TableCell className="text-right text-slate-300">
                      {agent.resolvedCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={
                          agent.resolutionRate >= 80
                            ? 'border-green-800/50 bg-green-500/10 text-green-400'
                            : agent.resolutionRate >= 50
                            ? 'border-yellow-800/50 bg-yellow-500/10 text-yellow-400'
                            : 'border-red-800/50 bg-red-500/10 text-red-400'
                        }
                      >
                        {agent.resolutionRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-slate-300">
                      {agent.avgResolutionMinutes !== null
                        ? `${agent.avgResolutionMinutes}m`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
