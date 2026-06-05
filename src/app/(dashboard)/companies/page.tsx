import { Suspense } from 'react';
import { CompaniesTable } from '@/components/companies/companies-table';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch companies server-side for initial render
  const { data: companies } = await supabase
    .from('companies')
    .select(`
      *,
      contacts (count)
    `)
    .eq('user_id', user.id)
    .order('name');

  return (
    <Suspense>
      <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div>
          <h1 className="text-2xl font-bold text-white">Companies</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage organizations and group your contacts.
          </p>
        </div>
        <CompaniesTable initialCompanies={companies ?? []} />
      </div>
    </Suspense>
  );
}
