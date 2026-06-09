import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Verify this is an internal call with a shared secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Query scheduled reports that are due
  const { data: reports } = await supabase
    .from('scheduled_reports')
    .select('*')
    .eq('is_active', true)
    .lte('next_send_at', new Date().toISOString())

  if (!reports || reports.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let processedCount = 0

  for (const report of reports) {
    // 1. Fetch report data (simulated internal fetch)
    console.log(`Generating report ${report.id} of type ${report.report_type} for account ${report.account_id}`)
    
    // 2. Send email
    // TODO: integrate email service (Resend recommended — add RESEND_API_KEY to .env.local)
    console.log(`Sending email to ${report.email} (Email service not configured - simulated)`)

    // 3. Update last_sent_at and next_send_at
    const now = new Date()
    let nextSend = new Date(now)
    
    if (report.frequency === 'weekly') {
      // Next Monday
      nextSend.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7))
      nextSend.setHours(8, 0, 0, 0)
    } else if (report.frequency === 'monthly') {
      // 1st of next month
      nextSend.setMonth(now.getMonth() + 1)
      nextSend.setDate(1)
      nextSend.setHours(8, 0, 0, 0)
    } else {
      // Default fallback (tomorrow)
      nextSend.setDate(now.getDate() + 1)
    }

    await supabase
      .from('scheduled_reports')
      .update({
        last_sent_at: now.toISOString(),
        next_send_at: nextSend.toISOString()
      })
      .eq('id', report.id)

    processedCount++
  }

  return NextResponse.json({ processed: processedCount })
}
