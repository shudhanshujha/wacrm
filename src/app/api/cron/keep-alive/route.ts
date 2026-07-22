import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUPABASE_PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!SUPABASE_PROJECT_URL) {
    return NextResponse.json({ error: 'Supabase URL not configured' }, { status: 500 })
  }

  const results: { service: string; ok: boolean; latencyMs?: number; error?: string }[] = []

  for (const endpoint of [
    `${SUPABASE_PROJECT_URL}/rest/v1/`,
    `${SUPABASE_PROJECT_URL}/auth/v1/`,
  ]) {
    const start = Date.now()
    try {
      const res = await fetch(endpoint, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10_000),
      })
      results.push({
        service: endpoint.replace(SUPABASE_PROJECT_URL, ''),
        ok: res.ok || res.status < 500,
        latencyMs: Date.now() - start,
      })
    } catch (err) {
      results.push({
        service: endpoint.replace(SUPABASE_PROJECT_URL, ''),
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const allOk = results.every((r) => r.ok)

  return NextResponse.json(
    { alive: allOk, checked: new Date().toISOString(), results },
    { status: allOk ? 200 : 503 },
  )
}
