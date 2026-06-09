import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Verify WooCommerce HMAC signature
function verifyWooCommerceWebhook(body: string, hmacHeader: string, secret: string): boolean {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64')
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader))
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const storeUrl = req.headers.get('x-wc-webhook-source') ?? ''
  const topic = req.headers.get('x-wc-webhook-topic') ?? ''         // e.g. order.created
  const hmacHeader = req.headers.get('x-wc-webhook-signature') ?? ''

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find the woocommerce connection for this store url
  const { data: connection } = await supabase
    .from('woocommerce_connections')
    .select('*')
    .eq('store_url', storeUrl)
    .eq('is_active', true)
    .single()

  if (!connection) return NextResponse.json({ error: 'Unknown store' }, { status: 404 })

  // Verify HMAC
  if (!verifyWooCommerceWebhook(rawBody, hmacHeader, connection.webhook_secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)

  // Map WooCommerce topic to our event type
  const eventTypeMap: Record<string, string> = {
    'order.created': 'order_created',
    'order.processing': 'order_processing',
    'order.completed': 'order_completed',
    'order.cancelled': 'order_cancelled',
  }

  const eventType = eventTypeMap[topic]
  if (!eventType) return NextResponse.json({ ok: true })  // ignore unhandled topics

  const customerPhone = payload.billing?.phone ?? null

  // Log the event
  await supabase.from('woocommerce_event_log').insert({
    account_id: connection.account_id,
    woo_order_id: String(payload.number ?? payload.id ?? 'unknown'),
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
      // Build template variables from WooCommerce order payload:
      // {{1}} = customer name, {{2}} = order number, {{3}} = total price
      const variables: Record<string, string> = {
        '1': payload.billing?.first_name ?? 'Customer',
        '2': String(payload.number ?? payload.id),
        '3': `${payload.currency ?? ''} ${payload.total ?? ''}`.trim(),
      }

      const normalizedPhone = customerPhone.replace(/\D/g, '')
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
          name: variables['1'],
        }).select('id').single()
        contact = newContact
      }

      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/whatsapp/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: connection.account_id,
          templateId,
          contacts: [{ id: contact?.id, phone: normalizedPhone, variables }],
          broadcastName: `WooCommerce ${eventType} — order ${variables['2']}`,
        }),
      })

      await supabase.from('woocommerce_event_log')
        .update({ status: 'sent' })
        .eq('account_id', connection.account_id)
        .eq('woo_order_id', String(payload.number ?? payload.id))
        .eq('event_type', eventType)
    }
  }

  return NextResponse.json({ ok: true })
}
