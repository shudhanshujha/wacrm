import { supabaseAdmin } from '@/lib/automations/admin-client'

export interface ExtractField {
  key: string       // custom_field key to store into (e.g. "order_number")
  label: string     // human label (e.g. "Order Number")
  type: 'text' | 'number' | 'date'
}

export interface ExtractConfig {
  fields: ExtractField[]
}

export async function executeAiExtractStep(
  config: ExtractConfig,
  context: { inboundMessage: string; contactId: string }
): Promise<{ extracted: Record<string, string | number | null> }> {
  const fieldsList = config.fields.map(f => `"${f.key}" (${f.label}, type: ${f.type})`).join(', ')

  const prompt = `Extract the following fields from this message: ${fieldsList}
Message: "${context.inboundMessage}"
Respond ONLY with a JSON object mapping field keys to extracted values (null if not found).
Example: {"order_number": "ORD-1234", "date": "2025-06-01"}`

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[AI Extract Step] GEMINI_API_KEY missing, skipping extraction')
    return { extracted: {} }
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
          maxOutputTokens: 200,
          temperature: 0.2,
        },
      }),
    })

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`)
    const data = await response.json()
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').replace(/```json|```/g, '').trim()
    const extracted = JSON.parse(text)

    // Save extracted fields to contact_custom_values
    const supabase = supabaseAdmin()
    
    // 1. Get the custom fields definitions to map keys to field IDs
    // Assuming config.fields.key corresponds to custom_fields.field_name or a slug.
    // For this prototype, we'll try to match by field_name.
    const { data: customFields } = await supabase
        .from('custom_fields')
        .select('id, field_name')
        
    if (customFields) {
        for (const [key, value] of Object.entries(extracted)) {
            if (value === null || value === undefined) continue;
            
            // Try to find the field ID
            const fieldDef = customFields.find(f => 
                f.field_name.toLowerCase() === key.toLowerCase() || 
                f.field_name.toLowerCase().replace(/\s+/g, '_') === key
            );
            
            if (fieldDef) {
                // Upsert the custom value
                await supabase.from('contact_custom_values').upsert({
                    contact_id: context.contactId,
                    custom_field_id: fieldDef.id,
                    value: String(value)
                }, { onConflict: 'contact_id, custom_field_id' })
            }
        }
    }

    return { extracted }
  } catch (err) {
      console.error('[AI Extract Step]', err)
    return { extracted: {} }
  }
}
