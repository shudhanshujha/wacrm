import { AgencyDashboard } from '@/components/agency/agency-dashboard'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AgencyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const { data: agencyCheck } = await supabase
    .from('agency_accounts')
    .select('id')
    .eq('agency_id', user.id)
    .limit(1)

  const isInitialAgency = !!(agencyCheck && agencyCheck.length > 0)

  return <AgencyDashboard isInitialAgency={isInitialAgency} />
}
