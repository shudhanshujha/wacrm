import { createClient as createAdminClient } from '@supabase/supabase-js'

function adminSupabase() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function generateCode(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function createShortLink(opts: {
  broadcastId: string
  recipientId: string | null
  contactId: string | null
  destinationUrl: string
  baseUrl: string
}): Promise<string> {
  const supabase = adminSupabase()
  const code = generateCode()

  await supabase.from('broadcast_short_links').insert({
    short_code: code,
    broadcast_id: opts.broadcastId,
    recipient_id: opts.recipientId,
    contact_id: opts.contactId,
    destination_url: opts.destinationUrl,
  })

  return `${opts.baseUrl}/api/r/${code}`
}
