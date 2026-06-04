'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CustomField, Tag } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Users,
  Tags,
  Filter,
  Upload,
  Loader2,
  ArrowRight,
  ArrowLeft,
  X,
  Sliders,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type AudienceType = 'all' | 'tags' | 'custom_field' | 'csv' | 'custom_segment' | 'multi_condition';
type CustomFieldOperator = 'is' | 'is_not' | 'contains' | 'is_set' | 'is_not_set';

interface CustomFieldFilter {
  fieldId: string;
  operator: CustomFieldOperator;
  value: string;
}

export interface AudienceCondition {
  id: string;
  type: 'tag' | 'custom_field' | 'contact_field';
  tagId?: string;
  tagOperator?: 'has' | 'does_not_have';
  customFieldId?: string;
  customFieldOperator?: CustomFieldOperator;
  customFieldValue?: string;
  contactField?: 'name' | 'email' | 'company' | 'phone';
  contactFieldOperator?: 'is_set' | 'is_not_set' | 'contains';
  contactFieldValue?: string;
}

interface AudienceConfig {
  type: AudienceType;
  tagIds?: string[];
  customField?: CustomFieldFilter;
  csvContacts?: { phone: string; name?: string }[];
  segmentContactIds?: string[];
  conditions?: AudienceCondition[];
  conditionLogic?: 'AND' | 'OR';
  excludeTagIds?: string[];
}

interface Step2Props {
  audience: AudienceConfig;
  onUpdate: (audience: AudienceConfig) => void;
  onNext: () => void;
  onBack: () => void;
}

const audienceOptions: {
  type: AudienceType;
  label: string;
  description: string;
  icon: typeof Users;
}[] = [
  {
    type: 'all',
    label: 'All Contacts',
    description: 'Send to every contact in your database',
    icon: Users,
  },
  {
    type: 'tags',
    label: 'Filter by Tags',
    description: 'Target contacts with specific tags',
    icon: Tags,
  },
  {
    type: 'custom_field',
    label: 'Custom Field',
    description: 'Filter by a custom field value',
    icon: Filter,
  },
  {
    type: 'multi_condition',
    label: 'Advanced Filter',
    description: 'Combine multiple tag and attribute conditions',
    icon: Sliders,
  },
  {
    type: 'csv',
    label: 'Upload CSV',
    description: 'Upload a list of phone numbers',
    icon: Upload,
  },
];

const OPERATOR_OPTIONS: { value: CustomFieldOperator; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
];

export function Step2SelectAudience({
  audience,
  onUpdate,
  onNext,
  onBack,
}: Step2Props) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  const [conditions, setConditions] = useState<AudienceCondition[]>(
    audience.conditions ?? [
      { id: Math.random().toString(36).slice(2, 9), type: 'tag', tagOperator: 'has' },
    ],
  );
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>(
    audience.conditionLogic ?? 'AND',
  );

  // Load custom fields if multi_condition is selected too
  useEffect(() => {
    if (audience.type !== 'custom_field' && audience.type !== 'multi_condition') return;
    async function fetchFields() {
      setLoadingFields(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('custom_fields')
          .select('*')
          .order('field_name');
        setCustomFields(data ?? []);
      } finally {
        setLoadingFields(false);
      }
    }
    fetchFields();
  }, [audience.type]);

  const fetchEstimatedCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const supabase = createClient();

      // Base query — produces the superset before exclude is applied.
      let baseIds: Set<string> | null = null; // null means "all contacts"

      if (audience.type === 'all') {
        // Handled below
      } else if (
        audience.type === 'tags' &&
        audience.tagIds &&
        audience.tagIds.length > 0
      ) {
        const { data } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', audience.tagIds);
        baseIds = new Set((data ?? []).map((r) => r.contact_id));
      } else if (
        audience.type === 'custom_field' &&
        audience.customField?.fieldId &&
        audience.customField.value
      ) {
        const { fieldId, operator, value } = audience.customField;
        let q = supabase
          .from('contact_custom_values')
          .select('contact_id')
          .eq('custom_field_id', fieldId);
        if (operator === 'is') q = q.eq('value', value);
        else if (operator === 'is_not') q = q.neq('value', value);
        else if (operator === 'contains') q = q.ilike('value', `%${value}%`);
        const { data } = await q;
        baseIds = new Set((data ?? []).map((r) => r.contact_id));
      } else if (
        audience.type === 'csv' &&
        audience.csvContacts &&
        audience.csvContacts.length > 0
      ) {
        setEstimatedCount(audience.csvContacts.length);
        return;
      } else if (audience.type === 'custom_segment') {
        baseIds = new Set(audience.segmentContactIds ?? []);
      } else if (audience.type === 'multi_condition') {
        // Client-side multi-condition estimation
        const { data: allContacts } = await supabase.from('contacts').select('id, name, email, company, phone');
        const { data: allTags } = await supabase.from('contact_tags').select('contact_id, tag_id');
        const { data: allCustomValues } = await supabase.from('contact_custom_values').select('contact_id, custom_field_id, value');

        const tagsByContact = new Map<string, Set<string>>();
        for (const ct of allTags ?? []) {
          const s = tagsByContact.get(ct.contact_id) ?? new Set();
          s.add(ct.tag_id);
          tagsByContact.set(ct.contact_id, s);
        }

        const customValuesByContact = new Map<string, Map<string, string>>();
        for (const cv of allCustomValues ?? []) {
          const m = customValuesByContact.get(cv.contact_id) ?? new Map();
          m.set(cv.custom_field_id, cv.value ?? '');
          customValuesByContact.set(cv.contact_id, m);
        }

        const filtered = (allContacts ?? []).filter(contact => {
          const results = conditions.map(cond => {
            if (cond.type === 'tag' && cond.tagId) {
              const hasTags = tagsByContact.get(contact.id)?.has(cond.tagId) ?? false;
              return cond.tagOperator === 'has' ? hasTags : !hasTags;
            }
            if (cond.type === 'custom_field' && cond.customFieldId) {
              const val = customValuesByContact.get(contact.id)?.get(cond.customFieldId) ?? '';
              if (cond.customFieldOperator === 'is_set') return val !== '';
              if (cond.customFieldOperator === 'is_not_set') return val === '';
              if (cond.customFieldOperator === 'is') return val === (cond.customFieldValue ?? '');
              if (cond.customFieldOperator === 'is_not') return val !== (cond.customFieldValue ?? '');
              if (cond.customFieldOperator === 'contains') return val.toLowerCase().includes((cond.customFieldValue ?? '').toLowerCase());
            }
            if (cond.type === 'contact_field' && cond.contactField) {
              const fieldMap: Record<string, string | undefined> = { name: contact.name, email: contact.email, company: contact.company, phone: contact.phone };
              const val = fieldMap[cond.contactField] ?? '';
              if (cond.contactFieldOperator === 'is_set') return val !== '';
              if (cond.contactFieldOperator === 'is_not_set') return val === '';
              if (cond.contactFieldOperator === 'contains') return val.toLowerCase().includes((cond.contactFieldValue ?? '').toLowerCase());
            }
            return true;
          });
          return conditionLogic === 'AND' ? results.every(Boolean) : results.some(Boolean);
        });
        baseIds = new Set(filtered.map(c => c.id));
      } else {
        setEstimatedCount(null);
        return;
      }

      // Apply exclude tags
      let excludeSet: Set<string> | null = null;
      if (audience.excludeTagIds && audience.excludeTagIds.length > 0) {
        const { data: excludeRows } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', audience.excludeTagIds);
        excludeSet = new Set((excludeRows ?? []).map((r) => r.contact_id));
      }

      if (baseIds) {
        const effective = [...baseIds].filter(
          (id) => !excludeSet?.has(id),
        );
        setEstimatedCount(effective.length);
      } else {
        // "All" — fetch the total, then subtract exclude set if any.
        const { count } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true });
        const total = count ?? 0;
        setEstimatedCount(excludeSet ? Math.max(0, total - excludeSet.size) : total);
      }
    } finally {
      setLoadingCount(false);
    }
  }, [
    audience.type,
    audience.tagIds,
    audience.customField,
    audience.csvContacts,
    audience.excludeTagIds,
  ]);

  useEffect(() => {
    fetchEstimatedCount();
  }, [fetchEstimatedCount]);

  function toggleTag(tagId: string) {
    const current = audience.tagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onUpdate({ ...audience, tagIds: updated });
  }

  function toggleExcludeTag(tagId: string) {
    const current = audience.excludeTagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onUpdate({ ...audience, excludeTagIds: updated });
  }

  function updateCustomField(patch: Partial<CustomFieldFilter>) {
    const prev = audience.customField ?? {
      fieldId: '',
      operator: 'is' as CustomFieldOperator,
      value: '',
    };
    onUpdate({ ...audience, customField: { ...prev, ...patch } });
  }

  const isValid =
    audience.type === 'all' ||
    (audience.type === 'tags' && audience.tagIds && audience.tagIds.length > 0) ||
    (audience.type === 'custom_field' &&
      !!audience.customField?.fieldId &&
      audience.customField.value.length > 0) ||
    (audience.type === 'csv' &&
      audience.csvContacts &&
      audience.csvContacts.length > 0) ||
    (audience.type === 'custom_segment' &&
      audience.segmentContactIds &&
      audience.segmentContactIds.length > 0) ||
    (audience.type === 'multi_condition' && conditions.length > 0);

  function addCondition() {
    const newConditions = [
      ...conditions,
      { id: Math.random().toString(36).slice(2, 9), type: 'tag' as const, tagOperator: 'has' as const },
    ];
    setConditions(newConditions);
    onUpdate({ ...audience, conditions: newConditions, conditionLogic });
  }

  function removeCondition(id: string) {
    const newConditions = conditions.filter((c) => c.id !== id);
    setConditions(newConditions);
    onUpdate({ ...audience, conditions: newConditions, conditionLogic });
  }

  function updateCondition(id: string, patch: Partial<AudienceCondition>) {
    const newConditions = conditions.map((c) =>
      c.id === id ? { ...c, ...patch } : c,
    );
    setConditions(newConditions);
    onUpdate({ ...audience, conditions: newConditions, conditionLogic });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Select Audience</h2>
        <p className="mt-1 text-sm text-slate-400">
          Choose who will receive this broadcast.
        </p>
      </div>

      {audience.type === 'custom_segment' ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Retarget Audience</p>
            <p className="mt-1 text-xs text-slate-400">
              {audience.segmentContactIds?.length ?? 0} contacts pre-selected from a previous broadcast.
            </p>
            <p className="mt-2 text-[10px] text-slate-500 italic">
              To change the audience, start a new broadcast.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {audienceOptions.map((option) => {
            const isSelected = audience.type === option.type;
            const Icon = option.icon;
            return (
              <button
                key={option.type}
                onClick={() =>
                  onUpdate({
                    ...audience,
                    type: option.type,
                    // Wipe shape fields from other types to avoid stale
                    // config leaking across selections.
                    tagIds: option.type === 'tags' ? audience.tagIds : undefined,
                    customField:
                      option.type === 'custom_field'
                        ? audience.customField
                        : undefined,
                    csvContacts:
                      option.type === 'csv' ? audience.csvContacts : undefined,
                    conditions: option.type === 'multi_condition' ? conditions : undefined,
                    conditionLogic: option.type === 'multi_condition' ? conditionLogic : undefined,
                  })
                }
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isSelected
                      ? 'bg-primary/10 text-primary'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{option.label}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {audience.type === 'multi_condition' && (
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">Advanced Filter Builder</p>
            <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-1">
              <button
                onClick={() => {
                  setConditionLogic('AND');
                  onUpdate({ ...audience, conditionLogic: 'AND' });
                }}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  conditionLogic === 'AND'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Match ALL (AND)
              </button>
              <button
                onClick={() => {
                  setConditionLogic('OR');
                  onUpdate({ ...audience, conditionLogic: 'OR' });
                }}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  conditionLogic === 'OR'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Match ANY (OR)
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {conditions.map((cond, idx) => (
              <div key={cond.id} className="group relative flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/30 p-3 pr-10">
                <Select
                  value={cond.type}
                  onValueChange={(val: any) => val && updateCondition(cond.id, { type: val })}
                >
                  <SelectTrigger className="h-9 w-[130px] border-slate-700 bg-slate-800 text-xs text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-900 text-white">
                    <SelectItem value="tag">Tag</SelectItem>
                    <SelectItem value="custom_field">Custom Field</SelectItem>
                    <SelectItem value="contact_field">Contact Field</SelectItem>
                  </SelectContent>
                </Select>

                {cond.type === 'tag' && (
                  <>
                    <Select
                      value={cond.tagOperator ?? 'has'}
                      onValueChange={(val: any) => val && updateCondition(cond.id, { tagOperator: val })}
                    >
                      <SelectTrigger className="h-9 w-[120px] border-slate-700 bg-slate-800 text-xs text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-slate-700 bg-slate-900 text-white">
                        <SelectItem value="has">has</SelectItem>
                        <SelectItem value="does_not_have">does not have</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={cond.tagId ?? ''}
                      onValueChange={(val) => val && updateCondition(cond.id, { tagId: val })}
                    >
                      <SelectTrigger className="h-9 flex-1 border-slate-700 bg-slate-800 text-xs text-white">
                        <SelectValue placeholder="Select tag..." />
                      </SelectTrigger>
                      <SelectContent className="border-slate-700 bg-slate-900 text-white">
                        {tags.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}

                {cond.type === 'custom_field' && (
                  <>
                    <Select
                      value={cond.customFieldId ?? ''}
                      onValueChange={(val) => val && updateCondition(cond.id, { customFieldId: val })}
                    >
                      <SelectTrigger className="h-9 w-[140px] border-slate-700 bg-slate-800 text-xs text-white">
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent className="border-slate-700 bg-slate-900 text-white">
                        {customFields.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.field_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={cond.customFieldOperator ?? 'is'}
                      onValueChange={(val: any) => val && updateCondition(cond.id, { customFieldOperator: val })}
                    >
                      <SelectTrigger className="h-9 w-[110px] border-slate-700 bg-slate-800 text-xs text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-slate-700 bg-slate-900 text-white">
                        <SelectItem value="is">is</SelectItem>
                        <SelectItem value="is_not">is not</SelectItem>
                        <SelectItem value="contains">contains</SelectItem>
                        <SelectItem value="is_set">is set</SelectItem>
                        <SelectItem value="is_not_set">is not set</SelectItem>
                      </SelectContent>
                    </Select>
                    {!['is_set', 'is_not_set'].includes(cond.customFieldOperator ?? '') && (
                      <input
                        type="text"
                        value={cond.customFieldValue ?? ''}
                        onChange={(e) => updateCondition(cond.id, { customFieldValue: e.target.value })}
                        placeholder="Value"
                        className="h-9 flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 text-xs text-white outline-none focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </>
                )}

                {cond.type === 'contact_field' && (
                  <>
                    <Select
                      value={cond.contactField ?? 'name'}
                      onValueChange={(val: any) => val && updateCondition(cond.id, { contactField: val })}
                    >
                      <SelectTrigger className="h-9 w-[110px] border-slate-700 bg-slate-800 text-xs text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-slate-700 bg-slate-900 text-white">
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={cond.contactFieldOperator ?? 'contains'}
                      onValueChange={(val: any) => val && updateCondition(cond.id, { contactFieldOperator: val })}
                    >
                      <SelectTrigger className="h-9 w-[110px] border-slate-700 bg-slate-800 text-xs text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-slate-700 bg-slate-900 text-white">
                        <SelectItem value="contains">contains</SelectItem>
                        <SelectItem value="is_set">is set</SelectItem>
                        <SelectItem value="is_not_set">is not set</SelectItem>
                      </SelectContent>
                    </Select>
                    {!['is_set', 'is_not_set'].includes(cond.contactFieldOperator ?? '') && (
                      <input
                        type="text"
                        value={cond.contactFieldValue ?? ''}
                        onChange={(e) => updateCondition(cond.id, { contactFieldValue: e.target.value })}
                        placeholder="Value"
                        className="h-9 flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 text-xs text-white outline-none focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </>
                )}

                <button
                  onClick={() => removeCondition(cond.id)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={addCondition}
            className="w-full border-dashed border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Add Condition
          </Button>
        </div>
      )}

      {audience.type === 'tags' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="mb-3 text-sm font-medium text-white">Select Tags</p>
          {loadingTags ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : tags.length === 0 ? (
            <p className="text-xs text-slate-400">
              No tags found. Create tags in Settings.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isSelected = audience.tagIds?.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span
                      className="mr-1.5 h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {audience.type === 'custom_field' && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-sm font-medium text-white">Custom Field Filter</p>
          {loadingFields ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : customFields.length === 0 ? (
            <p className="text-xs text-slate-400">
              No custom fields defined. Create one in Settings → Custom Fields.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)]">
              <select
                value={audience.customField?.fieldId ?? ''}
                onChange={(e) => updateCustomField({ fieldId: e.target.value })}
                className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Select field…</option>
                {customFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.field_name}
                  </option>
                ))}
              </select>
              <select
                value={audience.customField?.operator ?? 'is'}
                onChange={(e) =>
                  updateCustomField({
                    operator: e.target.value as CustomFieldOperator,
                  })
                }
                className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {OPERATOR_OPTIONS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={audience.customField?.value ?? ''}
                onChange={(e) => updateCustomField({ value: e.target.value })}
                placeholder="Value"
                className="h-9 rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
      )}

      {/* Exclude list — applies regardless of audience type */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <X className="h-4 w-4 text-red-400" />
          <p className="text-sm font-medium text-white">
            Exclude contacts with these tags
          </p>
          <span className="text-xs text-slate-500">(optional)</span>
        </div>
        {tags.length === 0 ? (
          <p className="text-xs text-slate-500">No tags available.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const isExcluded = audience.excludeTagIds?.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleExcludeTag(tag.id)}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    isExcluded
                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span
                    className="mr-1.5 h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Audience Summary */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="mb-2 text-sm font-medium text-white">Audience Summary</p>
        {loadingCount ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-slate-400">Calculating…</span>
          </div>
        ) : estimatedCount !== null ? (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm text-white">
              {estimatedCount.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">estimated recipients</span>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Select an audience type to see the estimate.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-800 pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="border-slate-700 text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!isValid}
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
