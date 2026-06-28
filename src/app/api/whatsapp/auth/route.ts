import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const META_API_VERSION = 'v21.0'
const OAUTH_DIALOG_URL = `https://www.facebook.com/${META_API_VERSION}/dialog/oauth`

/**
 * GET /api/whatsapp/auth
 *
 * Initiates the Meta OAuth flow. Redirects the user to Facebook's
 * OAuth dialog so they can authorize the app to access their
 * WhatsApp Business Account.
 *
 * Required env vars:
 *   META_APP_ID    — from Meta Developer → App → Settings → Basic
 *   META_APP_SECRET — already required for webhook verification
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const appId = process.env.META_APP_ID
    if (!appId) {
      return NextResponse.json(
        { error: 'META_APP_ID is not configured. Add it to your environment variables.' },
        { status: 500 }
      )
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://wacrm-six.vercel.app'}/api/whatsapp/auth/callback`

    // State param ties the callback to this user session (prevents CSRF)
    const state = Buffer.from(JSON.stringify({ userId: user.id, ts: Date.now() })).toString('base64')

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      scope: 'whatsapp_business_messaging,whatsapp_business_management,business_management',
      response_type: 'code',
    })

    return NextResponse.redirect(`${OAUTH_DIALOG_URL}?${params.toString()}`)
  } catch (error) {
    console.error('Error initiating OAuth:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
