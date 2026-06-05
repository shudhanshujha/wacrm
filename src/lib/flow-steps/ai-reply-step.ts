import { supabaseAdmin } from '@/lib/automations/admin-client'

export interface AiReplyConfig {
  system_prompt?: string
  max_tokens?: number
  temperature?: number
  fallback_message?: string
  context_messages?: number
}

export async function executeAiReplyStep(
  config: AiReplyConfig,
  context: {
    contactId: string
    conversationId: string
    inboundMessage: string
    contactName: string
    accountId: string
  }
): Promise<{ reply: string; success: boolean }> {
  const supabase = supabaseAdmin()

  // 1. Fetch recent conversation messages for context
  const contextCount = config.context_messages ?? 10
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('content_text, sender_type, created_at')
    .eq('conversation_id', context.conversationId)
    .order('created_at', { ascending: false })
    .limit(contextCount)

  const conversationHistory = (recentMessages ?? [])
    .reverse()
    .map(m => ({
      role: m.sender_type === 'customer' ? 'user' : 'model',
      parts: [{ text: m.content_text ?? '' }],
    }))
    .filter(m => m.parts[0].text.length > 0)

  const systemPrompt = config.system_prompt
    ?? `You are a helpful WhatsApp business assistant. You are helping a customer named ${context.contactName}. Be concise, friendly, and professional. Reply in 1-3 sentences.`

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[AI Reply Step] GEMINI_API_KEY missing, using fallback')
    return { reply: config.fallback_message ?? "I'm sorry, I couldn't process that.", success: false }
  }

  const fullPrompt = `${systemPrompt}\n\nSuggested Reply:`

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: conversationHistory.length > 0
          ? [
              ...conversationHistory,
              { role: 'user', parts: [{ text: fullPrompt }] }
            ]
          : [
              { role: 'user', parts: [{ text: context.inboundMessage }] },
              { role: 'user', parts: [{ text: fullPrompt }] }
            ],
        generationConfig: {
          maxOutputTokens: config.max_tokens ?? 300,
          temperature: config.temperature ?? 0.7,
        },
      }),
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errData)}`)
    }
    const data = await response.json()
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? config.fallback_message ?? "I'm sorry, I couldn't process that."
    return { reply, success: true }
  } catch (err) {
    console.error('[AI Reply Step]', err)
    return { reply: config.fallback_message ?? "I'm sorry, I couldn't process that.", success: false }
  }
}
