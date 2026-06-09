import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Verify this is an internal call with a shared secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find all active shopify connections
  const { data: connections } = await supabase
    .from('shopify_connections')
    .select('*')
    .eq('is_active', true)

  if (!connections || connections.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let processedCount = 0

  for (const connection of connections) {
    if (!connection.abandoned_cart_template_id) continue

    // Query pending abandoned carts older than the delay
    const delayMinutes = connection.abandoned_cart_delay_minutes || 60
    const cutoffTime = new Date(Date.now() - delayMinutes * 60000).toISOString()

    const { data: pendingEvents } = await supabase
      .from('shopify_event_log')
      .select('*')
      .eq('account_id', connection.account_id)
      .eq('event_type', 'abandoned_cart')
      .eq('status', 'pending')
      .lt('created_at', cutoffTime)

    if (!pendingEvents || pendingEvents.length === 0) continue

    for (const event of pendingEvents) {
      if (!event.customer_phone) {
        await supabase.from('shopify_event_log').update({ status: 'skipped', error_message: 'No phone number' }).eq('id', event.id)
        continue
      }

      // Mark as processing to prevent concurrent cron runs from sending duplicates
      await supabase.from('shopify_event_log').update({ status: 'processing' }).eq('id', event.id)

      const normalizedPhone = event.customer_phone.replace(/\D/g, '')
      let { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', connection.account_id)
        .eq('phone', normalizedPhone)
        .single()

      if (!contact) {
        const { data: newContact } = await supabase.from('contacts').insert({
          user_id: connection.account_id,
          phone: normalizedPhone,
          name: 'Customer',
        }).select('id').single()
        contact = newContact
      }

      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/whatsapp/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: connection.account_id,
            templateId: connection.abandoned_cart_template_id,
            contacts: [{ id: contact?.id, phone: normalizedPhone, variables: {} }],
            broadcastName: `Shopify abandoned_cart — order ${event.shopify_order_id}`,
          }),
        })

        await supabase.from('shopify_event_log').update({ status: 'sent' }).eq('id', event.id)
        processedCount++
      } catch (err) {
        await supabase.from('shopify_event_log').update({ status: 'failed', error_message: String(err) }).eq('id', event.id)
      }
    }
  }

  return NextResponse.json({ processed: processedCount })
}
