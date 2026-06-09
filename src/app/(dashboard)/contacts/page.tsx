import { createClient } from '@/lib/supabase/server';
import { ContactsClient } from './contacts-client';
import type { Tag, Company, Contact } from '@/types';
import { getActiveAccountId } from '@/lib/get-active-account-id';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

interface ContactWithTags extends Contact {
  tags?: Tag[];
  company_data?: { id: string; name: string } | null;
}

export default async function ContactsPage() {
  const supabase = await createClient();
  const activeAccountId = await getActiveAccountId();

  // 1. Fetch tags
  const { data: tagsData } = await supabase.from('tags').select('*').eq('user_id', activeAccountId);
  const tagsMap: Record<string, Tag> = {};
  if (tagsData) {
    tagsData.forEach((t) => (tagsMap[t.id] = t));
  }

  // 2. Fetch companies
  const { data: companiesData } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', activeAccountId)
    .order('name');

  // 3. Fetch initial contacts (first page, no filters)
  const { data: contactsData, count, error } = await supabase
    .from('contacts')
    .select('*, company_data:companies(id, name)', { count: 'exact' })
    .eq('user_id', activeAccountId)
    .eq('whatsapp_opted_out', false)
    .order('created_at', { ascending: false })
    .range(0, PAGE_SIZE - 1);

  let initialContacts: ContactWithTags[] = [];

  if (!error && contactsData) {
    const contactIds = contactsData.map((c) => c.id);
    const { data: contactTags } = await supabase
      .from('contact_tags')
      .select('contact_id, tag_id')
      .in('contact_id', contactIds);

    const tagsByContact: Record<string, string[]> = {};
    if (contactTags) {
      contactTags.forEach((ct) => {
        if (!tagsByContact[ct.contact_id]) tagsByContact[ct.contact_id] = [];
        tagsByContact[ct.contact_id].push(ct.tag_id);
      });
    }

    initialContacts = (contactsData as unknown as ContactWithTags[]).map((c) => ({
      ...c,
      tags: (tagsByContact[c.id] ?? [])
        .map((tid) => tagsMap[tid])
        .filter(Boolean),
    }));
  }

  return (
    <ContactsClient
      initialContacts={initialContacts}
      initialCount={count ?? 0}
      initialTags={tagsMap}
      initialCompanies={companiesData ?? []}
    />
  );
}
