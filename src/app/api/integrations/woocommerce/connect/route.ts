import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { storeUrl, consumerKey, consumerSecret, webhookSecret, accountId } = body

    if (!storeUrl || !consumerKey || !consumerSecret || !webhookSecret || !accountId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const cleanStoreUrl = storeUrl.replace(/\/$/, '')

    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Basic validation: try to fetch system status using the provided keys
    const authHeader = 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
    
    const shopResponse = await fetch(`${cleanStoreUrl}/wp-json/wc/v3/system_status`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    })

    if (!shopResponse.ok) {
      return NextResponse.json({ error: 'Invalid WooCommerce credentials or REST API disabled' }, { status: 401 })
    }

    // Upsert the connection
    const { error: upsertError } = await supabase
      .from('woocommerce_connections')
      .upsert({
        account_id: accountId,
        store_url: cleanStoreUrl,
        consumer_key: consumerKey, // TODO: encrypt with AES-256-GCM
        consumer_secret: consumerSecret, // TODO: encrypt with AES-256-GCM
        webhook_secret: webhookSecret,
        is_active: true
      }, { onConflict: 'account_id' })

    if (upsertError) {
      console.error('Error upserting woocommerce connection:', upsertError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Attempt to register webhooks with WooCommerce
    const webhookTopics = ['order.created', 'order.updated', 'order.deleted']
    const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/woocommerce/webhook`
    let manualWebhookSetup = false

    for (const topic of webhookTopics) {
      const res = await fetch(`${cleanStoreUrl}/wp-json/wc/v3/webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `WhatsApp CRM - ${topic}`,
          topic: topic,
          delivery_url: webhookUrl,
          secret: webhookSecret,
          status: 'active'
        })
      })
      if (!res.ok) {
         manualWebhookSetup = true
      }
    }

    return NextResponse.json({ success: true, storeUrl: cleanStoreUrl, manualWebhookSetup })
  } catch (error) {
    console.error('Error connecting to WooCommerce:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
