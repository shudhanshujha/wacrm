import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service role client — bypasses RLS so anonymous clicks can be logged
function adminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const supabase = adminClient()

  // Look up the short link
  const { data: link } = await supabase
    .from('broadcast_short_links')
    .select('*')
    .eq('short_code', code)
    .maybeSingle()

  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  }

  // Log the click (fire and forget — don't block the redirect)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = request.headers.get('user-agent') ?? null

  void Promise.all([
    supabase.from('broadcast_clicks').insert({
      broadcast_id: link.broadcast_id,
      contact_id: link.contact_id,
      recipient_id: link.recipient_id,
      short_code: code,
      destination_url: link.destination_url,
      ip,
      user_agent: userAgent,
    }),
    // Increment click_count on the recipient row and broadcast row via RPC
    link.recipient_id
      ? supabase.rpc('increment_recipient_click', { recipient_id: link.recipient_id })
      : Promise.resolve(),
  ]).catch(console.error)

  // Redirect immediately
  return NextResponse.redirect(link.destination_url, { status: 302 })
}
