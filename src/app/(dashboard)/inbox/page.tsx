import { createClient } from '@/lib/supabase/server'
import { InboxClient } from './inbox-client'
import type { Conversation } from '@/types'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const supabase = await createClient()

  // 1. Fetch initial conversations list (Server Side)
  const { data: convsData } = await supabase
    .from("conversations")
    .select("*, contact:contacts(*)")
    .order("last_message_at", { ascending: false })
    .limit(50);

  // 2. Check WhatsApp connection status
  const { data: { user } } = await supabase.auth.getUser();
  let initialConnected = null;
  if (user) {
    const { data } = await supabase
      .from("whatsapp_config")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    initialConnected = data?.status === "connected";
  }

  return (
    <InboxClient 
      initialConversations={(convsData as unknown as Conversation[]) ?? []} 
      initialConnected={initialConnected}
    />
  )
}
