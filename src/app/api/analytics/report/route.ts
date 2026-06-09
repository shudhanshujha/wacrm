import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'full'
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const format = searchParams.get('format') || 'json'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Build the time filter
  let timeFilter = ''
  if (from) timeFilter += `created_at.gte.${from},`
  if (to) timeFilter += `created_at.lte.${to}`
  if (timeFilter.endsWith(',')) timeFilter = timeFilter.slice(0, -1)

  const reportData: any = {}

  if (type === 'broadcasts' || type === 'full') {
    let query = supabase.from('broadcasts').select('id, name, created_at, status, sent_count, delivered_count, read_count, replied_count, failed_count').eq('user_id', user.id)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)
    const { data: broadcasts } = await query
    
    reportData.broadcasts = broadcasts || []
  }

  if (type === 'inbox' || type === 'full') {
    let query = supabase.from('conversations').select('id, created_at, status, unread_count').eq('user_id', user.id)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)
    const { data: conversations } = await query
    
    reportData.inbox = conversations || []
  }

  if (type === 'contacts' || type === 'full') {
    let query = supabase.from('contacts').select('id, created_at, whatsapp_opted_out').eq('user_id', user.id)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to)
    const { data: contacts } = await query
    
    reportData.contacts = contacts || []
  }

  if (format === 'csv') {
    // Generate CSV output
    let csv = ''
    if (type === 'broadcasts' || type === 'full') {
      csv += 'Broadcasts\nName,Date,Sent,Delivered,Read,Replied,Failed\n'
      reportData.broadcasts?.forEach((b: any) => {
        csv += `"${b.name}",${b.created_at},${b.sent_count},${b.delivered_count},${b.read_count},${b.replied_count},${b.failed_count}\n`
      })
      csv += '\n'
    }
    if (type === 'contacts' || type === 'full') {
      csv += 'Contacts\nID,Date,OptedOut\n'
      reportData.contacts?.forEach((c: any) => {
        csv += `${c.id},${c.created_at},${c.whatsapp_opted_out}\n`
      })
      csv += '\n'
    }

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="wacrm-report-${from || 'all'}-${to || 'all'}.csv"`
      }
    })
  }

  return NextResponse.json(reportData)
}
