'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { MessageTemplate, AudienceCondition } from '@/types';
import { Step1ChooseTemplate } from '@/components/broadcasts/step1-choose-template';
import { Step2SelectAudience } from '@/components/broadcasts/step2-select-audience';
import { Step3Personalize } from '@/components/broadcasts/step3-personalize';
import { Step4ScheduleSend } from '@/components/broadcasts/step4-schedule-send';
import { useBroadcastSending } from '@/hooks/use-broadcast-sending';
import { Check } from 'lucide-react';

const steps = [
  { label: 'Template', key: 'template' },
  { label: 'Audience', key: 'audience' },
  { label: 'Personalize', key: 'personalize' },
  { label: 'Send', key: 'send' },
] as const;

export default function NewBroadcastContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { createAndSendBroadcast, isProcessing, progress } = useBroadcastSending();

  const isRetarget = searchParams.get('retarget') === 'true';
  const retargetName = searchParams.get('name') ?? '';
  const retargetContactIds = searchParams.get('contactIds')?.split(',').filter(Boolean) ?? [];

  const [currentStep, setCurrentStep] = useState(0);
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [audience, setAudience] = useState<{
    type: 'all' | 'tags' | 'custom_field' | 'csv' | 'custom_segment' | 'multi_condition';
    tagIds?: string[];
    customField?: {
      fieldId: string;
      operator: 'is' | 'is_not' | 'contains' | 'is_set' | 'is_not_set';
      value: string;
    };
    csvContacts?: { phone: string; name?: string }[];
    excludeTagIds?: string[];
    segmentContactIds?: string[];
    conditions?: AudienceCondition[];
    conditionLogic?: 'AND' | 'OR';
  }>(
    isRetarget
      ? { type: 'custom_segment', segmentContactIds: retargetContactIds }
      : { type: 'all' }
  );
  const [variables, setVariables] = useState<
    Record<string, { type: 'static' | 'field' | 'custom_field'; value: string }>
  >({});
  const [name, setName] = useState(isRetarget ? retargetName : '');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  // A/B Testing State
  const [abTestEnabled, setAbTestEnabled] = useState(false);
  const [templateB, setTemplateB] = useState<MessageTemplate | null>(null);
  const [abSplitPercent, setAbSplitPercent] = useState(50); // Variant A %

  async function handleSend() {
    if (!template) return;

    if (abTestEnabled && !templateB) {
      toast.error('Please select Variant B for the A/B test.');
      return;
    }

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        toast.error('Not signed in.');
        return;
      }

      if (abTestEnabled && templateB) {
        // 1. Create a parent "shell" broadcast row
        const { data: parentBroadcast, error: parentErr } = await supabase
          .from('broadcasts')
          .insert({
            user_id: user.id,
            name: name.trim(),
            template_name: template.name, // Just for reference
            template_language: template.language ?? 'en_US',
            status: 'ab_test',
            ab_test_enabled: true,
            total_recipients: 0,
            sent_count: 0,
            delivered_count: 0,
            read_count: 0,
            replied_count: 0,
            failed_count: 0,
            clicked_count: 0,
          })
          .select()
          .single();

        if (parentErr || !parentBroadcast) {
          toast.error('Failed to create A/B test parent');
          return;
        }

        // 2. Resolve the full audience
        // Note: For a robust implementation, this should ideally happen server-side
        // to avoid transferring large contact lists to the client. For this prototype,
        // we'll fetch them here to split them.
        let contacts: { id: string }[] = [];
        if (audience.type === 'all') {
          const { data } = await supabase.from('contacts').select('id').eq('whatsapp_opted_out', false);
          contacts = data ?? [];
        } else if (audience.type === 'tags' && audience.tagIds) {
          const { data: contactTags } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', audience.tagIds);
          
          if (contactTags) {
            const uniqueIds = Array.from(new Set(contactTags.map(ct => ct.contact_id)));
            const { data } = await supabase.from('contacts').select('id').in('id', uniqueIds).eq('whatsapp_opted_out', false);
            contacts = data ?? [];
          }
        } else {
            // Fallback for custom_field, multi_condition, etc. This is simplified for the prototype.
            // A full implementation would reuse the resolveAudience logic from use-broadcast-sending.ts
            toast.error('A/B testing is currently only supported for "All Contacts" or "Tags" audience types in this prototype.');
            return;
        }

        if (contacts.length === 0) {
            toast.error('Resolved audience is empty.');
            return;
        }

        // 3. Shuffle (Fisher-Yates) and split the audience
        const shuffled = [...contacts];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const splitIndex = Math.floor((shuffled.length * abSplitPercent) / 100);
        const groupAIds = shuffled.slice(0, splitIndex).map(c => c.id);
        const groupBIds = shuffled.slice(splitIndex).map(c => c.id);

        if (groupAIds.length === 0 || groupBIds.length === 0) {
            toast.error('Audience is too small to split meaningfully.');
            return;
        }

        // 4. Send Variant A
        await createAndSendBroadcast({
          name: `${name.trim()} (Variant A)`,
          template,
          audience: { type: 'custom_segment', segmentContactIds: groupAIds },
          variables, // Reusing same variables for both for now
          abTestConfig: { parentId: parentBroadcast.id, variant: 'A', splitPercent: abSplitPercent }
        });

        // 5. Send Variant B
        await createAndSendBroadcast({
          name: `${name.trim()} (Variant B)`,
          template: templateB,
          audience: { type: 'custom_segment', segmentContactIds: groupBIds },
          variables, // Reusing same variables for both for now
          abTestConfig: { parentId: parentBroadcast.id, variant: 'B', splitPercent: 100 - abSplitPercent }
        });

        toast.success('A/B test broadcast launched');
        router.push('/broadcasts');
        return;
      }

      // Existing single-template send logic follows
      if (scheduledAt) {
        // Handle scheduling
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) {
          toast.error('Not signed in.');
          return;
        }

        const { error } = await supabase.from('broadcasts').insert({
          user_id: user.id,
          name: name.trim(),
          template_name: template.name,
          template_language: template.language ?? 'en_US',
          template_variables: variables,
          audience_filter: {
            type: audience.type,
            tagIds: audience.tagIds,
            customField: audience.customField,
            excludeTagIds: audience.excludeTagIds,
          },
          status: 'scheduled',
          scheduled_at: scheduledAt.toISOString(),
          total_recipients: 0, // Will be resolved at send time by worker/engine
          sent_count: 0,
          delivered_count: 0,
          read_count: 0,
          replied_count: 0,
          failed_count: 0,
        });

        if (error) {
          toast.error(`Failed to schedule broadcast: ${error.message}`);
          return;
        }

        toast.success('Broadcast scheduled');
        router.push('/broadcasts');
      } else {
        // Send immediately
        const broadcastId = await createAndSendBroadcast({
          name,
          template,
          audience: {
            type: audience.type,
            tagIds: audience.tagIds,
            customField: audience.customField,
            excludeTagIds: audience.excludeTagIds,
          },
          variables,
        });
        router.push(`/broadcasts/${broadcastId}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Broadcast failed';
      console.error('Broadcast failed:', err);
      toast.error(message);
    }
  }

  async function handleSaveDraft() {
    if (!template || !name.trim()) {
      toast.error('Give the broadcast a name before saving a draft.');
      return;
    }
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      toast.error('Not signed in.');
      return;
    }

    const { error } = await supabase.from('broadcasts').insert({
      user_id: user.id,
      name: name.trim(),
      template_name: template.name,
      template_language: template.language ?? 'en_US',
      template_variables: variables,
      audience_filter: {
        type: audience.type,
        tagIds: audience.tagIds,
      },
      status: 'draft',
      total_recipients: 0,
      sent_count: 0,
      delivered_count: 0,
      read_count: 0,
      replied_count: 0,
      failed_count: 0,
    });

    if (error) {
      toast.error(`Failed to save draft: ${error.message}`);
      return;
    }
    toast.success('Draft saved');
    router.push('/broadcasts');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">New Broadcast</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and send a broadcast message to your contacts.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <div key={step.key} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : isActive
                        ? 'border-2 border-primary bg-primary/10 text-primary'
                        : 'border border-border bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <span
                  className={`hidden text-sm font-medium sm:block ${
                    isActive ? 'text-foreground' : isCompleted ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-3 h-px flex-1 ${
                    index < currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="relative min-h-[400px]">
        <div
          className="transition-all duration-300 ease-in-out"
          style={{
            opacity: isProcessing ? 0.6 : 1,
            pointerEvents: isProcessing ? 'none' : 'auto',
          }}
        >
          {currentStep === 0 && (
            <Step1ChooseTemplate
              selectedTemplate={template}
              onSelect={setTemplate}
              onNext={() => setCurrentStep(1)}
              onBack={() => router.push('/broadcasts')}
              abTestEnabled={abTestEnabled}
              onAbTestEnabledChange={setAbTestEnabled}
              templateB={templateB}
              onTemplateBChange={setTemplateB}
              abSplitPercent={abSplitPercent}
              onAbSplitPercentChange={setAbSplitPercent}
            />
          )}
          {currentStep === 1 && (
            <Step2SelectAudience
              audience={audience}
              onUpdate={setAudience}
              onNext={() => setCurrentStep(2)}
              onBack={() => setCurrentStep(0)}
            />
          )}
          {currentStep === 2 && template && (
            <Step3Personalize
              template={template}
              variables={variables}
              onUpdate={setVariables}
              onNext={() => setCurrentStep(3)}
              onBack={() => setCurrentStep(1)}
            />
          )}
          {currentStep === 3 && template && (
            <Step4ScheduleSend
              name={name}
              onNameChange={setName}
              template={template}
              audience={audience}
              onSend={handleSend}
              onSaveDraft={handleSaveDraft}
              onBack={() => setCurrentStep(2)}
              isProcessing={isProcessing}
              progress={progress}
              scheduledAt={scheduledAt}
              onScheduledAtChange={setScheduledAt}
            />
          )}
        </div>
      </div>
    </div>
  );
}
