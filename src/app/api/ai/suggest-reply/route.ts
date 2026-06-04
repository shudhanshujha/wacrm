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

  const systemPrompt = `You are a helpful WhatsApp business assistant. `+
You are helping a business agent reply to a customer named ${contactName}.
${businessContext ? `Business context: ${businessContext}` : ''}
Suggest ONE short, professional, friendly reply (max 3 sentences).
Reply ONLY with the suggested message text — no preamble, no quotes, no explanation.`

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service unavailable (API key missing)' }, { status: 502 })
  }

  // Format history for Gemini
  // Gemini expects a series of { role: 'user' | 'model', parts: [{ text: string }] }
  const contents = messages.slice(-10).map(m => ({
    role: m.role === 'inbound' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))

  // If the last message was outbound, Gemini might struggle with role alternating,
  // so we ensure it ends on a user message or handle it gracefully.
  // Actually, for suggestions, we want to prompt Gemini with the whole context.

  const fullPrompt = `${systemPrompt}\n\nConversation so far:\n${messages.slice(-10).map(m => `${m.role === 'inbound' ? 'Customer' : 'Agent'}: ${m.content}`).join('\n')}\n\nSuggested Reply:`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: fullPrompt }],
          }
        ],
        generationConfig: {
          maxOutputTokens: 256,
          temperature: 0.7,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error:', errorData);
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 })
    }

    const data = await response.json()
    const suggestion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    return NextResponse.json({ suggestion })
  } catch (err) {
    console.error('Suggest reply fetch error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
