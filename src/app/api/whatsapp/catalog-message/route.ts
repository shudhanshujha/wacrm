import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { conversationId, type, bodyText, products, sectionTitle } = body

  // Fetch conversation to get phone number
  const { data: conversation } = await supabase
    .from('conversations')
    .select('*, contact:contacts(phone)')
    .eq('id', conversationId)
    .single()

  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  
  const phoneNumber = (conversation as unknown as { contact: { phone: string } }).contact?.phone
  if (!phoneNumber) return NextResponse.json({ error: 'Contact phone not found' }, { status: 400 })

  // Fetch account WhatsApp credentials
  const { data: config } = await supabase
    .from('whatsapp_config')
    .select('phone_number_id, access_token')
    .eq('user_id', user.id)
    .single()

  if (!config) return NextResponse.json({ error: 'WhatsApp config not found' }, { status: 400 })

  const catalogId = process.env.META_CATALOG_ID
  if (!catalogId) {
    return NextResponse.json({ error: 'Server misconfiguration: META_CATALOG_ID not set' }, { status: 500 })
  }

  // Build the Meta API interactive message payload
  let interactivePayload: Record<string, unknown>

  if (type === 'single_product') {
    interactivePayload = {
      type: 'product',
      body: { text: bodyText || ' ' },
      action: {
        catalog_id: catalogId,
        product_retailer_id: products[0].retailer_id,
      },
    }
  } else {
    // product_list
    interactivePayload = {
      type: 'product_list',
      header: { type: 'text', text: 'Our Products' },
      body: { text: bodyText || 'Check out our products' },
      action: {
        catalog_id: catalogId,
        sections: [
          {
            title: sectionTitle ?? 'Products',
            product_items: products.map((p: { retailer_id: string }) => ({
              product_retailer_id: p.retailer_id,
            })),
          },
        ],
      },
    }
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phoneNumber,
    type: 'interactive',
    interactive: interactivePayload,
  }

  const url = `https://graph.facebook.com/v19.0/${config.phone_number_id}/messages`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    console.error('Meta API Error:', errData)
    return NextResponse.json(
      { error: 'Failed to send catalog message via Meta API' },
      { status: 502 }
    )
  }

  const metaData = await response.json()
  const messageId = metaData.messages?.[0]?.id

  // Record the outbound message in our database
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    user_id: user.id,
    contact_id: conversation.contact_id,
    content_text: type === 'single_product' ? `[Product: ${products[0].retailer_id}] ${bodyText || ''}` : `[Product List: ${products.length} items] ${bodyText || ''}`,
    sender_type: 'agent',
    message_type: 'interactive',
    status: 'sent',
    message_id: messageId,
    created_at: new Date().toISOString(),
  })

  // Update conversation last_message
  await supabase.from('conversations').update({
    last_message_text: 'Sent product catalog',
    last_message_at: new Date().toISOString(),
    status: conversation.status === 'pending' ? 'open' : conversation.status,
  }).eq('id', conversationId)

  return NextResponse.json({ success: true, messageId })
}
