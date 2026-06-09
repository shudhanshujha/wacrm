import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { shopDomain, accessToken, accountId } = body

    if (!shopDomain || !accessToken || !accountId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Basic validation: try to fetch shop info using the provided token
    const shopResponse = await fetch(`https://${shopDomain}/admin/api/2024-01/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    })

    if (!shopResponse.ok) {
      return NextResponse.json({ error: 'Invalid Shopify credentials' }, { status: 401 })
    }

    const webhookSecret = crypto.randomUUID()

    // Upsert the connection
    const { error: upsertError } = await supabase
      .from('shopify_connections')
      .upsert({
        account_id: accountId,
        shop_domain: shopDomain,
        access_token: accessToken, // TODO: encrypt with AES-256-GCM
        webhook_secret: webhookSecret,
        is_active: true
      }, { onConflict: 'account_id' })

    if (upsertError) {
      console.error('Error upserting shopify connection:', upsertError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Register webhooks with Shopify
    const webhookTopics = ['orders/create', 'orders/fulfilled', 'orders/cancelled', 'checkouts/create']
    const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/shopify/webhook`

    for (const topic of webhookTopics) {
      await fetch(`https://${shopDomain}/admin/api/2024-01/webhooks.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhook: {
            topic: topic,
            address: webhookUrl,
            format: 'json'
          }
        })
      })
    }

    return NextResponse.json({ success: true, shopDomain })
  } catch (error) {
    console.error('Error connecting to Shopify:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
