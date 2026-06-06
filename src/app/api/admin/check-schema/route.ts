import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Check tables and columns
    const results: Record<string, unknown> = {}
    
    // 1. Check contacts table columns
    const { data: contactCols, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .limit(1)
    
    if (contactError) {
      results.contacts_table = { status: 'error', message: contactError.message }
    } else {
      const firstRow = contactCols?.[0] ?? {}
      results.contacts_table = {
        status: 'ok',
        has_company_id: 'company_id' in firstRow,
        has_whatsapp_opted_out: 'whatsapp_opted_out' in firstRow,
      }
    }

    // 2. Check companies table
    const { error: companyError } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
    
    results.companies_table = {
      status: companyError ? 'error' : 'ok',
      message: companyError ? companyError.message : 'Table exists',
    }

    // 3. Check broadcasts columns
    const { data: bcData, error: bcError } = await supabase
      .from('broadcasts')
      .select('*')
      .limit(1)
    
    if (bcError) {
      results.broadcasts_table = { status: 'error', message: bcError.message }
    } else {
      const firstRow = bcData?.[0] ?? {}
      results.broadcasts_table = {
        status: 'ok',
        has_ab_test_enabled: 'ab_test_enabled' in firstRow,
        has_clicked_count: 'clicked_count' in firstRow,
      }
    }

    // 4. Check canned_replies table
    const { error: cannedError } = await supabase
      .from('canned_replies')
      .select('id')
      .limit(1)
    
    results.canned_replies_table = {
      status: cannedError ? 'error' : 'ok',
      message: cannedError ? cannedError.message : 'Table exists',
    }

    return NextResponse.json(results)
  } catch {
    return NextResponse.json({ error: 'Failed to run diagnostics' }, { status: 500 })
  }
}
