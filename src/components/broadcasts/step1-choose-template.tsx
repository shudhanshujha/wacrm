'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, ArrowRight, Beaker } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const categoryColors: Record<string, string> = {
  Marketing: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Utility: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Authentication: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

interface Step1Props {
  selectedTemplate: MessageTemplate | null;
  onSelect: (template: MessageTemplate) => void;
  onNext: () => void;
  onBack: () => void;
  abTestEnabled?: boolean;
  onAbTestEnabledChange?: (enabled: boolean) => void;
  templateB?: MessageTemplate | null;
  onTemplateBChange?: (template: MessageTemplate | null) => void;
  abSplitPercent?: number;
  onAbSplitPercentChange?: (percent: number) => void;
}

export function Step1ChooseTemplate({
  selectedTemplate,
  onSelect,
  onNext,
  onBack,
  abTestEnabled = false,
  onAbTestEnabledChange,
  templateB = null,
  onTemplateBChange,
  abSplitPercent = 50,
  onAbSplitPercentChange,
}: Step1Props) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('message_templates')
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setTemplates(data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setLoading(false);
      }
    }

    fetchTemplates();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Choose a Template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select an approved message template for your broadcast.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-border bg-card">
          <FileText className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No templates available.</p>
          <p className="mt-1 text-xs text-muted-foreground/70">Create a template in Settings first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const isSelected = selectedTemplate?.id === template.id;
            const catColor = categoryColors[template.category] ?? categoryColors.Utility;

            return (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className={`flex flex-col gap-3 rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border bg-card hover:border-input hover:bg-accent'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-medium text-foreground">{template.name}</h3>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${catColor}`}
                  >
                    {template.category}
                  </span>
                </div>
                <p className="line-clamp-3 text-xs text-muted-foreground">{template.body_text}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{template.language ?? 'en_US'}</span>
                  {template.status && (
                    <>
                      <span>-</span>
                      <span>{template.status}</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {onAbTestEnabledChange && onTemplateBChange && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-primary" />
              <div>
                <Label htmlFor="ab-test" className="text-sm font-medium text-foreground">
                  Enable A/B Test
                </Label>
                <p className="text-xs text-muted-foreground">
                  Test two templates against each other to see which performs better.
                </p>
              </div>
            </div>
            <Switch
              id="ab-test"
              checked={abTestEnabled}
              onCheckedChange={onAbTestEnabledChange}
              className="data-[state=checked]:bg-primary"
            />
          </div>

          {abTestEnabled && (
            <div className="mt-6 space-y-4 border-t border-border pt-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Variant A <span className="font-normal text-muted-foreground/70">— currently selected template above</span>
                </p>
              </div>
              
              <div>
                <p className="mb-3 text-sm font-medium text-muted-foreground">Audience Split</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Variant A %</Label>
                    <input
                      type="range"
                      min="10"
                      max="90"
                      step="5"
                      value={abSplitPercent}
                      onChange={(e) => onAbSplitPercentChange?.(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                  <div className="flex w-32 shrink-0 items-center justify-between rounded-lg border border-input bg-muted px-3 py-2 text-sm font-medium text-foreground">
                    <span>A: {abSplitPercent}%</span>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-fuchsia-400">B: {100 - abSplitPercent}%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <p className="mb-3 text-sm font-medium text-muted-foreground">Variant B</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {templates.map((template) => {
                    const isSelected = templateB?.id === template.id;
                    const catColor = categoryColors[template.category] ?? categoryColors.Utility;
                    // Usually you don't want Variant A and B to be the exact same template
                    const isSameAsA = selectedTemplate?.id === template.id;

                    return (
                      <button
                        key={`b-${template.id}`}
                        onClick={() => onTemplateBChange(template)}
                        disabled={isSameAsA}
                        className={`flex flex-col gap-3 rounded-xl border p-4 text-left transition-all ${
                          isSelected
                            ? 'border-fuchsia-500/50 bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30'
                            : isSameAsA
                              ? 'border-border/50 bg-muted/20 opacity-40 cursor-not-allowed'
                              : 'border-border bg-card hover:border-input hover:bg-accent'
                        }`}
                      >
                        <div className="flex items-start justify-between w-full">
                          <h3 className="text-sm font-medium text-foreground">{template.name}</h3>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${catColor}`}
                          >
                            {template.category}
                          </span>
                        </div>
                        <p className="line-clamp-3 text-xs text-muted-foreground">{template.body_text}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{template.language ?? 'en_US'}</span>
                          {template.status && (
                            <>
                              <span>-</span>
                              <span>{template.status}</span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="outline" onClick={onBack} className="border-input text-muted-foreground">
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedTemplate}
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
