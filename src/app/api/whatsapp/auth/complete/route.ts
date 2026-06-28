import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/whatsapp/auth/complete
 *
 * Completes the OAuth onboarding by saving the user's selected
 * phone number. Updates the whatsapp_config from 'pending_oauth'
 * to 'connected' with the chosen number.
 *
 * Body: { phone_number_id: string }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { phone_number_id } = await request.json()
    if (!phone_number_id) {
      return NextResponse.json({ error: 'phone_number_id is required' }, { status: 400 })
    }

    // Fetch the display name from the pending options for the success message
    const { data: phoneOption } = await supabase
      .from('oauth_phone_options')
      .select('display_phone_number, verified_name')
      .eq('user_id', user.id)
      .eq('phone_number_id', phone_number_id)
      .maybeSingle()

    // Update the config with the selected phone number
    const { error: updateError } = await supabase
      .from('whatsapp_config')
      .update({
        phone_number_id,
        status: 'connected',
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('status', 'pending_oauth')

    if (updateError) {
      console.error('[whatsapp/oauth/complete] Failed to complete setup:', updateError)
      return NextResponse.json({ error: 'Failed to complete setup' }, { status: 500 })
    }

    // Clean up the phone options
    await supabase
      .from('oauth_phone_options')
      .delete()
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      phone: phoneOption?.display_phone_number ?? phone_number_id,
      name: phoneOption?.verified_name ?? null,
    })
  } catch (error) {
    console.error('[whatsapp/oauth/complete] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
