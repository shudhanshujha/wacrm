'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface RetargetModalProps {
  broadcastId: string;
  broadcastName: string;
  stats: {
    delivered: number;
    read: number;
    replied: number;
    clicked: number;
    failed: number;
    total: number;
  };
  open: boolean;
  onClose: () => void;
}

type SegmentType = 'delivered_not_read' | 'read_not_replied' | 'replied' | 'failed';

export function RetargetModal({
  broadcastId,
  broadcastName,
  stats,
  open,
  onClose,
}: RetargetModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<SegmentType>('read_not_replied');
  const [newName, setNewName] = useState(`Retarget: ${broadcastName}`);

  const segments: { type: SegmentType; name: string; description: string; count: number }[] = [
    {
      type: 'delivered_not_read',
      name: 'Delivered but not Read',
      description: 'People who received the message but haven\'t opened it yet.',
      count: stats.delivered - stats.read,
    },
    {
      type: 'read_not_replied',
      name: 'Read but not Replied',
      description: 'People who saw your message but didn\'t take action.',
      count: stats.read - stats.replied,
    },
    {
      type: 'replied',
      name: 'Replied',
      description: 'People who engaged with your previous campaign.',
      count: stats.replied,
    },
    {
      type: 'failed',
      name: 'Failed',
      description: 'People who didn\'t receive the previous message.',
      count: stats.failed,
    },
  ];

  async function handleRetarget() {
    setLoading(true);
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('broadcast_recipients')
        .select('contact_id')
        .eq('broadcast_id', broadcastId);

      if (selectedSegment === 'delivered_not_read') {
        query = query.eq('status', 'delivered');
      } else if (selectedSegment === 'read_not_replied') {
        query = query.eq('status', 'read');
      } else if (selectedSegment === 'replied') {
        query = query.eq('status', 'replied');
      } else if (selectedSegment === 'failed') {
        query = query.eq('status', 'failed');
      }

      const { data, error } = await query;
      if (error) throw error;

      const contactIds = (data ?? []).map((r) => r.contact_id).filter(Boolean);
      
      if (contactIds.length === 0) {
        toast.error('No contacts found in this segment.');
        return;
      }

      const queryParams = new URLSearchParams({
        retarget: 'true',
        name: newName,
        contactIds: contactIds.join(','),
      });

      router.push(`/broadcasts/new?${queryParams.toString()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create retarget audience');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="border-border bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">Retarget Audience</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a new broadcast targeting a specific segment of this campaign's recipients.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {segments.map((segment) => (
              <button
                key={segment.type}
                onClick={() => setSelectedSegment(segment.type)}
                className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                  selectedSegment === segment.type
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-transparent hover:bg-accent'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-sm font-bold text-foreground">{segment.name}</span>
                  <span className="text-xs font-medium text-primary">{segment.count}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{segment.description}</p>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">New Broadcast Name</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Retarget Broadcast Name"
              className="border-border bg-background text-foreground"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-border text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleRetarget}
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Create Retarget Broadcast
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
