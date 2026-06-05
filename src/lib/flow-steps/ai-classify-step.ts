export interface ClassifyConfig {
  categories: Array<{ id: string; label: string; description: string }>
  fallback_category_id: string
  context_messages?: number
}

export async function executeAiClassifyStep(
  config: ClassifyConfig,
  context: { inboundMessage: string; contactName: string }
): Promise<{ category_id: string; category_label: string; confidence: 'high' | 'medium' | 'low' }> {
  const categoriesText = config.categories
    .map(c => `- "${c.id}": ${c.label}${c.description ? ` (${c.description})` : ''}`)
    .join('\n')

  const prompt = `Classify this WhatsApp message from ${context.contactName} into exactly one of these categories:
${categoriesText}

Message: "${context.inboundMessage}"

Respond ONLY with a JSON object, no other text:
{"category_id": "<id>", "confidence": "high"|"medium"|"low"}`

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[AI Classify Step] GEMINI_API_KEY missing, using fallback')
    const fallback = config.categories.find(c => c.id === config.fallback_category_id)
    return {
      category_id: config.fallback_category_id,
      category_label: fallback?.label ?? 'Fallback',
      confidence: 'low',
    }
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: prompt }] }
        ],
        generationConfig: {
          maxOutputTokens: 80,
          temperature: 0.2, // low temp for classification
        },
      }),
    })

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`)
    const data = await response.json()
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
    const parsed = JSON.parse(text.replace(/```json|```/g, ''))
    
    const matchedCategory = config.categories.find(c => c.id === parsed.category_id)
    return {
      category_id: matchedCategory?.id ?? config.fallback_category_id,
      category_label: matchedCategory?.label ?? 'Unknown',
      confidence: parsed.confidence ?? 'low',
    }
  } catch (err) {
    console.error('[AI Classify Step]', err)
    const fallback = config.categories.find(c => c.id === config.fallback_category_id)
    return {
      category_id: config.fallback_category_id,
      category_label: fallback?.label ?? 'Fallback',
      confidence: 'low',
    }
  }
}
