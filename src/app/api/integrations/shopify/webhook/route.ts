import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Verify Shopify HMAC signature — mirror the Meta HMAC verification pattern in the existing webhook route
function verifyShopifyWebhook(body: string, hmacHeader: string, secret: string): boolean {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64')
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader))
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const shopDomain = req.headers.get('x-shopify-shop-domain') ?? ''
  const topic = req.headers.get('x-shopify-topic') ?? ''         // e.g. orders/create
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256') ?? ''

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find the shopify connection for this shop domain
  const { data: connection } = await supabase
    .from('shopify_connections')
    .select('*')
    .eq('shop_domain', shopDomain)
    .eq('is_active', true)
    .single()

  if (!connection) return NextResponse.json({ error: 'Unknown shop' }, { status: 404 })

  // Verify HMAC
  if (!verifyShopifyWebhook(rawBody, hmacHeader, connection.webhook_secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)

  // Map Shopify topic to our event type
  const eventTypeMap: Record<string, string> = {
    'orders/create': 'order_created',
    'orders/fulfilled': 'order_fulfilled',
    'orders/cancelled': 'order_cancelled',
    'checkouts/create': 'abandoned_cart',
  }

  const eventType = eventTypeMap[topic]
  if (!eventType) return NextResponse.json({ ok: true })  // ignore unhandled topics

  const customerPhone = payload.customer?.phone
    ?? payload.billing_address?.phone
    ?? payload.shipping_address?.phone
    ?? null

  // Log the event
  await supabase.from('shopify_event_log').insert({
    account_id: connection.account_id,
    shopify_order_id: String(payload.id ?? payload.token ?? 'unknown'),
    event_type: eventType,
    customer_phone: customerPhone,
    status: customerPhone ? 'pending' : 'skipped',
    error_message: customerPhone ? null : 'No phone number in order',
  })

  // If we have a phone number, send the WhatsApp notification
  if (customerPhone) {
    // Get the right template ID for this event type
    const templateIdField = `${eventType}_template_id` as keyof typeof connection
    const templateId = connection[templateIdField] as string | null

    if (templateId) {
      // Build template variables from Shopify order payload:
      // {{1}} = customer name, {{2}} = order number, {{3}} = total price
      const variables: Record<string, string> = {
        '1': payload.customer?.first_name ?? payload.billing_address?.first_name ?? 'Customer',
        '2': payload.order_number ?? payload.name ?? String(payload.id),
        '3': `${payload.currency ?? ''} ${payload.total_price ?? ''}`.trim(),
      }

      // Use the existing send API pattern to send the message
      // Fetch the template, then call the Meta API using the pattern from broadcast/route.ts
      // Look up or create a contact for this phone number first:
      const normalizedPhone = customerPhone.replace(/\D/g, '')
      let { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', connection.account_id) // using user_id instead of account_id as per initial schema
        .eq('phone', normalizedPhone)
        .single()

      if (!contact) {
        const { data: newContact } = await supabase.from('contacts').insert({
          user_id: connection.account_id,
          phone: normalizedPhone,
          name: variables['1'],
        }).select('id').single()
        contact = newContact
      }

      // Enqueue the send — call your internal broadcast send API via fetch
      // POST to /api/whatsapp/broadcast with a single-contact audience
      // This reuses all existing rate limiting and error handling
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/whatsapp/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: connection.account_id,
          templateId,
          contacts: [{ id: contact?.id, phone: normalizedPhone, variables }],
          broadcastName: `Shopify ${eventType} — order ${variables['2']}`,
        }),
      })

      await supabase.from('shopify_event_log')
        .update({ status: 'sent' })
        .eq('account_id', connection.account_id)
        .eq('shopify_order_id', String(payload.id ?? payload.token))
        .eq('event_type', eventType)
    }
  }

  return NextResponse.json({ ok: true })
}
