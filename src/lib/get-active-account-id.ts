import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function getActiveAccountId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const cookieStore = await cookies()
  const actingAs = cookieStore.get('acting_as_account_id')?.value

  if (actingAs) {
    // Verify the current user is actually the agency for this client
    const { data } = await supabase
      .from('agency_accounts')
      .select('client_id')
      .eq('agency_id', user.id)
      .eq('client_id', actingAs)
      .eq('is_active', true)
      .single()

    if (data) return actingAs  // verified — use client's account_id
  }

  return user.id  // default — use own account
}

// IMPORTANT: Replace auth.uid() with getActiveAccountId() in Server Component data fetches
// to enable agency impersonation. Do NOT apply this to auth-sensitive routes
// (billing, settings/branding, settings/agency). Start by applying it to:
// broadcasts/page.tsx, contacts/page.tsx, inbox/page.tsx, analytics pages.
// Apply incrementally — do NOT do a global find/replace in this prompt.
