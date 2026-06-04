'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowLeft, Send, Loader2, Users, Save, Clock } from 'lucide-react';

interface AudienceConfig {
  type: string;
  tagIds?: string[];
  csvContacts?: { phone: string; name?: string }[];
}

interface Step4Props {
  name: string;
  onNameChange: (name: string) => void;
  template: MessageTemplate;
  audience: AudienceConfig;
  onSend: () => void;
  onSaveDraft?: () => void;
  onBack: () => void;
  isProcessing: boolean;
  progress: number;
  scheduledAt: Date | null;
  onScheduledAtChange: (date: Date | null) => void;
}

const TIMEZONES = [
  "Asia/Kolkata",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Dubai",
  "Asia/Singapore",
];

export function Step4ScheduleSend({
  name,
  onNameChange,
  template,
  audience,
  onSend,
  onSaveDraft,
  onBack,
  isProcessing,
  progress,
  scheduledAt,
  onScheduledAtChange,
}: Step4Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [estimatedReach, setEstimatedReach] = useState<number>(0);
  const [loadingReach, setLoadingReach] = useState(true);

  // Local state for scheduling inputs
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>(scheduledAt ? 'later' : 'now');
  const [scheduleDate, setScheduleDate] = useState(scheduledAt ? scheduledAt.toISOString().split('T')[0] : '');
  const [scheduleTime, setScheduleTime] = useState(scheduledAt ? scheduledAt.toTimeString().slice(0, 5) : '');
  const [scheduleTimezone, setScheduleTimezone] = useState('Asia/Kolkata');

  useEffect(() => {
    async function calculateReach() {
      setLoadingReach(true);
      try {
        const supabase = createClient();

        if (audience.type === 'all') {
          const { count } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true });
          setEstimatedReach(count ?? 0);
        } else if (audience.type === 'tags' && audience.tagIds && audience.tagIds.length > 0) {
          const { data: contactTags } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', audience.tagIds);

          const uniqueIds = new Set((contactTags ?? []).map((ct) => ct.contact_id));
          setEstimatedReach(uniqueIds.size);
        } else if (audience.type === 'csv' && audience.csvContacts) {
          setEstimatedReach(audience.csvContacts.length);
        } else {
          setEstimatedReach(0);
        }
      } finally {
        setLoadingReach(false);
      }
    }

    calculateReach();
  }, [audience]);

  // Handle schedule changes
  useEffect(() => {
    if (scheduleType === 'now') {
      onScheduledAtChange(null);
    } else if (scheduleDate && scheduleTime) {
      // Create date object in the specified timezone
      const dateStr = `${scheduleDate}T${scheduleTime}:00`;
      // This is a simplified way to handle timezones for the prototype.
      // In a real app, you'd use a library like luxon or date-fns-tz.
      const date = new Date(dateStr);
      onScheduledAtChange(date);
    }
  }, [scheduleType, scheduleDate, scheduleTime, scheduleTimezone, onScheduledAtChange]);

  const audienceLabel =
    audience.type === 'all'
      ? 'All Contacts'
      : audience.type === 'tags'
        ? `Tags (${audience.tagIds?.length ?? 0} selected)`
        : audience.type === 'csv'
          ? 'CSV Upload'
          : 'Custom';

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Review & Send</h2>
        <p className="mt-1 text-sm text-slate-400">
          Name your broadcast, review the details, and send.
        </p>
      </div>

      {/* Broadcast Name */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-white">Broadcast Name</label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Summer Sale Announcement"
          className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Schedule Section */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-white">Schedule (optional)</label>
        <RadioGroup
          value={scheduleType}
          onValueChange={(val: 'now' | 'later') => setScheduleType(val)}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="now" id="now" />
            <Label htmlFor="now" className="text-sm text-white">Send now</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="later" id="later" />
            <Label htmlFor="later" className="text-sm text-white">Schedule for later</Label>
          </div>
        </RadioGroup>

        {scheduleType === 'later' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Date</Label>
              <Input
                type="date"
                min={today}
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Time</Label>
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">Timezone</Label>
              <Select value={scheduleTimezone} onValueChange={(val) => val && setScheduleTimezone(val)}>
                <SelectTrigger className="w-full border-slate-700 bg-slate-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-900 text-white">
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Summary Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <p className="text-sm font-medium text-white">Summary</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-400">Template</p>
            <p className="text-white">{template.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Audience</p>
            <p className="text-white">{audienceLabel}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Estimated Reach</p>
            <div className="flex items-center gap-1.5">
              {loadingReach ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              ) : (
                <>
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <p className="font-medium text-white">{estimatedReach.toLocaleString()}</p>
                </>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400">Language</p>
            <p className="text-white">{template.language ?? 'en_US'}</p>
          </div>
        </div>
      </div>

      {/* Processing overlay */}
      {isProcessing && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm font-medium text-white">Sending broadcast...</p>
            </div>
            <span className="text-xs font-medium text-primary">{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-800">
            <div
              className="h-1.5 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isProcessing}
          className="border-slate-700 text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {onSaveDraft && (
            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={!name.trim() || isProcessing}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save as Draft
            </Button>
          )}

          <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
            <DialogTrigger
              render={
                <Button
                  disabled={!name.trim() || isProcessing || (scheduleType === 'later' && (!scheduleDate || !scheduleTime))}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                />
              }
            >
              {scheduledAt ? <Clock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {scheduledAt ? 'Schedule Broadcast' : 'Send Broadcast'}
            </DialogTrigger>
            <DialogContent className="border-slate-700 bg-slate-900 sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white">
                  {scheduledAt ? 'Confirm Schedule' : 'Confirm Broadcast'}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {scheduledAt ? (
                    <>
                      You are scheduling this broadcast to be sent to{' '}
                      <span className="font-medium text-white">{estimatedReach.toLocaleString()}</span>{' '}
                      contacts on{' '}
                      <span className="font-medium text-white">{scheduledAt.toLocaleString()}</span>{' '}
                      using the{' '}
                      <span className="font-medium text-white">{template.name}</span> template.
                    </>
                  ) : (
                    <>
                      You are about to send this broadcast to{' '}
                      <span className="font-medium text-white">{estimatedReach.toLocaleString()}</span>{' '}
                      contacts using the{' '}
                      <span className="font-medium text-white">{template.name}</span> template.
                      This action cannot be undone.
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowConfirm(false)}
                  className="border-slate-700 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setShowConfirm(false);
                    onSend();
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {scheduledAt ? <Clock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {scheduledAt ? 'Confirm & Schedule' : 'Confirm & Send'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
