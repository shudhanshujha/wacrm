import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Building2,
  Globe,
  MapPin,
  Phone,
  Briefcase,
  DollarSign,
  Tag as TagIcon
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Fetch Company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('id', params.id)
    .single();

  if (companyError || !company) {
    return (
      <div className="flex-1 p-8">
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-red-300">
          Company not found.
        </div>
      </div>
    );
  }

  // 2. Fetch linked Contacts with their tags
  const { data: contacts } = await supabase
    .from('contacts')
    .select(`
      id, name, phone, email, whatsapp_opted_out,
      contact_tags (
        tags (id, name, color)
      )
    `)
    .eq('company_id', company.id)
    .order('name');

  const contactIds = (contacts ?? []).map(c => c.id);

  // 3. Fetch Deals linked to these contacts to calculate pipeline value
  let totalPipelineValue = 0;
  if (contactIds.length > 0) {
    const { data: deals } = await supabase
      .from('deals')
      .select('value, status')
      .in('contact_id', contactIds)
      .neq('status', 'lost'); // Don't count lost deals in pipeline value

    totalPipelineValue = (deals ?? []).reduce((sum, deal) => sum + (Number(deal.value) || 0), 0);
  }

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-slate-950">
      {/* Header */}
      <div className="flex items-start gap-4 border-b border-slate-800 pb-6">
        <Link href="/companies">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-white shrink-0 mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800 border border-slate-700">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white truncate">{company.name}</h1>
              {company.domain && (
                <a href={`https://${company.domain}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1 mt-1">
                  <Globe className="h-3 w-3" /> {company.domain}
                </a>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Briefcase className="h-4 w-4 text-slate-500" />
              <span className="truncate">{company.industry || 'No industry set'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Phone className="h-4 w-4 text-slate-500" />
              <span className="truncate">{company.phone || 'No phone set'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <MapPin className="h-4 w-4 text-slate-500" />
              <span className="truncate">{company.address || 'No address set'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-md w-fit">
              <DollarSign className="h-4 w-4" />
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalPipelineValue)}
              <span className="text-xs text-green-500 ml-1 font-normal uppercase tracking-wide">Pipeline</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content: Contacts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Contacts at {company.name}</h2>
            <span className="inline-flex items-center justify-center rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-700">
              {contacts?.length ?? 0}
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Name</TableHead>
                  <TableHead className="text-slate-400">Phone</TableHead>
                  <TableHead className="text-slate-400 hidden sm:table-cell">Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-slate-500 text-sm">
                      No contacts linked to this company.
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts?.map((contact) => (
                    <TableRow key={contact.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                      <TableCell>
                        <Link href={`/contacts`} className="font-medium text-white hover:text-primary transition-colors">
                          {contact.name || 'Unknown'}
                        </Link>
                        {contact.whatsapp_opted_out && (
                          <span className="ml-2 text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">Opted Out</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-300 font-mono text-xs">
                        {contact.phone}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {contact.contact_tags?.slice(0, 3).map((ct: any) => ct.tags && (
                            <span
                              key={ct.tags.id}
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{ backgroundColor: `${ct.tags.color}20`, color: ct.tags.color, borderColor: ct.tags.color, borderWidth: 1 }}
                            >
                              {ct.tags.name}
                            </span>
                          ))}
                          {(contact.contact_tags?.length ?? 0) > 3 && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-800 text-slate-400">
                              +{(contact.contact_tags?.length ?? 0) - 3}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Sidebar: Notes & Details */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Internal Notes</h3>
            {company.notes ? (
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{company.notes}</p>
            ) : (
              <p className="text-sm text-slate-500 italic">No notes added for this company.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
