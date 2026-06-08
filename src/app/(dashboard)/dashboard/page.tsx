import { createClient } from '@/lib/supabase/server'
import { loadMetrics } from '@/lib/dashboard/queries'
import { DashboardClient } from './dashboard-client'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const db = await createClient()
  
  // Pre-fetch only the main metrics on the server.
  // The charts and activity feed remain client-side for better UX (skeletons + parallel loading).
  let initialMetrics = null
  try {
    initialMetrics = await loadMetrics(db)
  } catch (err) {
    console.error('[dashboard-page] failed to pre-fetch metrics:', err)
  }

  return <DashboardClient initialMetrics={initialMetrics} />
}
