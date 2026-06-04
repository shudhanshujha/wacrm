'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Megaphone, ArrowDownLeft, ArrowUpRight, Clock, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type TimelineItem =
  | { type: 'message'; id: string; content: string; direction: string; status: string; created_at: string; conversation_id: string }
  | { type: 'broadcast'; id: string; broadcast_name: string; status: string; created_at: string }

interface ContactTimelineProps {
  contactId: string
}

export function ContactTimeline({ contactId }: ContactTimelineProps) {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/contacts/${contactId}/timeline`)
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [contactId])

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
  
  if (items.length === 0) return (
    <div className="py-12 text-center">
      <p className="text-sm text-slate-500">No activity yet.</p>
    </div>
  );

  return (
    <div className="relative space-y-0 py-4">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-800" />

      {items.map((item, idx) => (
        <div key={item.id + idx} className="relative flex gap-4 pb-6 pl-10 last:pb-0">
          {/* Icon bubble */}
          <div className={cn(
            "absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 bg-slate-900 shadow-sm z-10",
            item.type === 'broadcast' ? "ring-2 ring-blue-500/20" : 
            item.direction === 'inbound' ? "ring-2 ring-green-500/20" : "ring-2 ring-primary/20"
          )}>
            {item.type === 'broadcast' ? (
              <Megaphone className="h-3.5 w-3.5 text-blue-400" />
            ) : item.direction === 'inbound' ? (
              <ArrowDownLeft className="h-3.5 w-3.5 text-green-400" />
            ) : (
              <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
            )}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-3 transition-colors hover:bg-slate-900/50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {item.type === 'message' ? (
                  <p className="text-sm text-slate-200 line-clamp-3 leading-relaxed">
                    {item.content || <span className="italic text-slate-500">(media message)</span>}
                  </p>
                ) : (
                  <p className="text-sm text-slate-200">
                    Received Broadcast: <span className="font-semibold text-primary">{item.broadcast_name}</span>
                  </p>
                )}
              </div>
              <Badge variant="outline" className={cn(
                "shrink-0 text-[10px] uppercase tracking-wider font-bold h-5",
                item.status === 'read' || item.status === 'replied' ? "border-green-500/30 text-green-400" :
                item.status === 'failed' ? "border-red-500/30 text-red-400" :
                "border-slate-700 text-slate-500"
              )}>
                {item.status}
              </Badge>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-slate-500 uppercase tracking-tight">
              <Clock className="h-3 w-3" />
              <span>{new Date(item.created_at).toLocaleString()}</span>
              {item.type === 'message' && (
                <>
                  <span className="mx-1">•</span>
                  <span className="text-slate-600">{item.direction}</span>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
