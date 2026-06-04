import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, contactName, businessContext } = await req.json() as {
    messages: Array<{ role: 'inbound' | 'outbound'; content: string; created_at: string }>
    contactName: string
    businessContext?: string
  }

  // Build conversation history for Claude
  const conversationHistory = messages.slice(-10).map(m => ({
    role: m.role === 'inbound' ? 'user' : 'assistant',
    content: m.content,
  }))

  const systemPrompt = `You are a helpful WhatsApp business assistant. 
You are helping a business agent reply to a customer named ${contactName}.
${businessContext ? `Business context: ${businessContext}` : ''}
Suggest ONE short, professional, friendly reply (max 3 sentences).
Reply ONLY with the suggested message text — no preamble, no quotes, no explanation.`

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service unavailable (API key missing)' }, { status: 502 })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022', // Updated to a valid current model name
        max_tokens: 256,
        system: systemPrompt,
        messages: conversationHistory.length > 0
          ? conversationHistory
          : [{ role: 'user', content: 'Hello' }],
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Anthropic API error:', errorData);
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 })
    }

    const data = await response.json()
    const suggestion = data.content?.[0]?.text ?? ''
    return NextResponse.json({ suggestion })
  } catch (err) {
    console.error('Suggest reply fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
