import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/whatsapp/auth/pending
 *
 * Returns the pending OAuth phone number options for the current user.
 * Called by the settings UI when ?oauth=pick is active, so the user
 * can select which phone number to connect.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the pending config
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('status, waba_id, waba_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (configError) {
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
    }

    // Get the available phone number options
    const { data: phones, error: phonesError } = await supabase
      .from('oauth_phone_options')
      .select('*')
      .eq('user_id', user.id)
      .order('display_phone_number', { ascending: true })

    if (phonesError) {
      return NextResponse.json({ error: 'Failed to fetch phone options' }, { status: 500 })
    }

    return NextResponse.json({
      pending: config?.status === 'pending_oauth',
      wabaName: config?.waba_name ?? null,
      phones: phones ?? [],
    })
  } catch (error) {
    console.error('[whatsapp/oauth/pending] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
