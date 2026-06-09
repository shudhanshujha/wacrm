import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Optionally verify agency status here if needed.
    // For now, anyone can create their first client, making them an agency.

    const body = await req.json()
    const { email, clientName } = body

    if (!email || !clientName) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Create the user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true
    })

    if (userError || !userData.user) {
      console.error('Error creating user:', userError)
      return NextResponse.json({ error: userError?.message || 'Failed to create user' }, { status: 500 })
    }

    const newUserId = userData.user.id

    // Insert relationship
    const { error: relError } = await supabaseAdmin.from('agency_accounts').insert({
      agency_id: user.id,
      client_id: newUserId,
      client_name: clientName
    })

    if (relError) {
      console.error('Error creating agency relationship:', relError)
      // Cleanup user if failed? Best effort.
    }

    // Send recovery link (best effort)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email
    })
    
    if (linkError) {
      console.error('Error generating recovery link:', linkError.message)
    }
    
    if (linkData && linkData.properties) {
       console.log('Recovery link for client:', linkData.properties.action_link)
       // TODO: send via Resend API
    }

    return NextResponse.json({ success: true, clientId: newUserId })
  } catch (error) {
    console.error('Error in create-client API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
