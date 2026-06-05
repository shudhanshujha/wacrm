import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: contactId } = await params;

  // Fetch last 50 messages for this contact
  const { data: messages } = await supabase
    .from('messages')
    .select('id, content_text, sender_type, message_type, status, created_at, conversation_id')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch broadcast receipts
  const { data: broadcastReceipts } = await supabase
    .from('broadcast_recipients')
    .select('id, broadcast_id, status, created_at, broadcasts(name)')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Combine and sort by created_at descending
  type TimelineItem =
    | { type: 'message'; id: string; content: string; direction: string; status: string; created_at: string; conversation_id: string }
    | { type: 'broadcast'; id: string; broadcast_name: string; status: string; created_at: string }

  const items: TimelineItem[] = [
    ...(messages ?? []).map(m => ({
      type: 'message' as const,
      id: m.id,
      content: m.content_text ?? '',
      direction: m.sender_type === 'customer' ? 'inbound' : 'outbound',
      status: m.status,
      created_at: m.created_at,
      conversation_id: m.conversation_id,
    })),
    ...(broadcastReceipts ?? []).map(r => ({
      type: 'broadcast' as const,
      id: r.id,
      broadcast_name: (r.broadcasts as unknown as { name: string } | null)?.name ?? 'Unknown Broadcast',
      status: r.status,
      created_at: r.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 60)

  return NextResponse.json({ items })
}
