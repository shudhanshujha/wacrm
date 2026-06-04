import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fallback: compute agent stats from conversations + messages directly
  // This avoids issues with querying auth.users from a standard client.
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, assigned_agent_id, status, created_at, updated_at')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  if (!conversations) return NextResponse.json({ agents: [] })

  // Group by assigned_agent_id
  const agentMap = new Map<string, {
    agentId: string
    conversationsHandled: number
    resolvedCount: number
    totalDurationSeconds: number
    resolvedWithDuration: number
  }>()

  for (const conv of conversations) {
    if (!conv.assigned_agent_id) continue
    const existing = agentMap.get(conv.assigned_agent_id) ?? {
      agentId: conv.assigned_agent_id,
      conversationsHandled: 0,
      resolvedCount: 0,
      totalDurationSeconds: 0,
      resolvedWithDuration: 0,
    }
    existing.conversationsHandled++
    if (conv.status === 'closed') {
      existing.resolvedCount++
      const duration = (new Date(conv.updated_at).getTime() - new Date(conv.created_at).getTime()) / 1000
      if (duration > 0) {
        existing.totalDurationSeconds += duration
        existing.resolvedWithDuration++
      }
    }
    agentMap.set(conv.assigned_agent_id, existing)
  }

  // Fetch agent names from profiles
  const agentIds = [...agentMap.keys()]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name')
    .in('user_id', agentIds)

  const agents = [...agentMap.values()].map(a => {
    const profile = profiles?.find(p => p.user_id === a.agentId)
    return {
      agentId: a.agentId,
      agentName: profile?.full_name ?? `Agent (${a.agentId.slice(0, 8)})`,
      conversationsHandled: a.conversationsHandled,
      resolvedCount: a.resolvedCount,
      resolutionRate: a.conversationsHandled > 0
        ? Math.round((a.resolvedCount / a.conversationsHandled) * 100)
        : 0,
      avgResolutionMinutes: a.resolvedWithDuration > 0
        ? Math.round(a.totalDurationSeconds / a.resolvedWithDuration / 60)
        : null,
    }
  })

  return NextResponse.json({ agents })
}
