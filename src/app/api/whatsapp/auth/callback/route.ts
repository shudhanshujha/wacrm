import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/whatsapp/encryption'
import {
  exchangeOAuthCode,
  extendAccessToken,
  listWhatsAppBusinessAccounts,
  listPhoneNumbers,
} from '@/lib/whatsapp/meta-api'

/**
 * GET /api/whatsapp/auth/callback
 *
 * Handles the OAuth redirect from Meta after the user authorizes
 * the app. Exchanges the code for a long-lived token, fetches the
 * user's WhatsApp Business Accounts and phone numbers, and stores
 * them as a pending configuration. The user then picks which phone
 * number to connect in the settings UI.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorReason = searchParams.get('error_reason')
    const errorDescription = searchParams.get('error_description')

    // Handle user denying the OAuth dialog
    if (error) {
      console.error('[whatsapp/oauth] User denied or error:', errorReason, errorDescription)
      return NextResponse.redirect(
        new URL('/settings?oauth=denied', request.url)
      )
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/settings?oauth=error&reason=missing_code', request.url)
      )
    }

    // Verify state to prevent CSRF
    if (!state) {
      return NextResponse.redirect(
        new URL('/settings?oauth=error&reason=missing_state', request.url)
      )
    }

    let stateData: { userId: string }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    } catch {
      return NextResponse.redirect(
        new URL('/settings?oauth=error&reason=invalid_state', request.url)
      )
    }

    // Authenticate the user who started the flow
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || user.id !== stateData.userId) {
      return NextResponse.redirect(
        new URL('/settings?oauth=error&reason=unauthorized', request.url)
      )
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://wacrm-six.vercel.app'}/api/whatsapp/auth/callback`

    // Step 1: Exchange the authorization code for a short-lived token
    const { accessToken: shortLivedToken } = await exchangeOAuthCode(code, redirectUri)

    // Step 2: Extend to a long-lived token (60 days)
    const { accessToken } = await extendAccessToken(shortLivedToken)

    // Step 3: Fetch the user's WABAs and phone numbers
    const wabas = await listWhatsAppBusinessAccounts(accessToken)

    if (wabas.length === 0) {
      return NextResponse.redirect(
        new URL('/settings?oauth=error&reason=no_waba', request.url)
      )
    }

    // Fetch phone numbers for the first WABA (most users have just one)
    const wabaId = wabas[0].id
    const wabaName = wabas[0].name
    const phones = await listPhoneNumbers(wabaId, accessToken)

    if (phones.length === 0) {
      return NextResponse.redirect(
        new URL('/settings?oauth=error&reason=no_phone', request.url)
      )
    }

    // Encrypt the token for storage
    const encryptedToken = encrypt(accessToken)

    // If only one phone number, save directly
    if (phones.length === 1) {
      const phone = phones[0]
      const { error: upsertError } = await supabase.from('whatsapp_config').upsert(
        {
          user_id: user.id,
          phone_number_id: phone.id,
          waba_id: wabaId,
          access_token: encryptedToken,
          status: 'connected',
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      if (upsertError) {
        console.error('[whatsapp/oauth] Failed to save config:', upsertError)
        return NextResponse.redirect(
          new URL('/settings?oauth=error&reason=save_failed', request.url)
        )
      }
      return NextResponse.redirect(
        new URL(`/settings?oauth=success&phone=${encodeURIComponent(phone.display_phone_number)}&name=${encodeURIComponent(phone.verified_name)}`, request.url)
      )
    }

    // Multiple phone numbers — store as pending config for user to pick
    const { error: pendingError } = await supabase.from('whatsapp_config').upsert(
      {
        user_id: user.id,
        waba_id: wabaId,
        waba_name: wabaName,
        access_token: encryptedToken,
        status: 'pending_oauth',
      },
      { onConflict: 'user_id' }
    )
    if (pendingError) {
      console.error('[whatsapp/oauth] Failed to save pending config:', pendingError)
      return NextResponse.redirect(
        new URL('/settings?oauth=error&reason=save_failed', request.url)
      )
    }

    // Store available phone numbers in a separate table for the picker
    // Upsert each phone number option
    for (const phone of phones) {
      await supabase.from('oauth_phone_options').upsert(
        {
          user_id: user.id,
          phone_number_id: phone.id,
          waba_id: wabaId,
          display_phone_number: phone.display_phone_number,
          verified_name: phone.verified_name,
          quality_rating: phone.quality_rating,
        },
        { onConflict: 'user_id,phone_number_id' }
      )
    }

    return NextResponse.redirect(
      new URL(`/settings?oauth=pick&count=${phones.length}`, request.url)
    )
  } catch (error) {
    console.error('[whatsapp/oauth] Callback error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.redirect(
      new URL(`/settings?oauth=error&reason=${encodeURIComponent(message)}`, request.url)
    )
  }
}
