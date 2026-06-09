'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileBarChart, Download, FileText, Calendar, Filter } from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function ReportsDashboard() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  
  const [datePreset, setDatePreset] = useState('7d')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    // Calculate dates based on preset
    const now = new Date()
    let start = new Date()
    
    if (datePreset === '7d') {
      start.setDate(now.getDate() - 7)
    } else if (datePreset === '30d') {
      start.setDate(now.getDate() - 30)
    } else if (datePreset === '90d') {
      start.setDate(now.getDate() - 90)
    } else if (datePreset === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (datePreset === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      now.setDate(0) // Last day of previous month
    } else {
      return // Custom dates used
    }
    
    setFromDate(start.toISOString().split('T')[0])
    setToDate(now.toISOString().split('T')[0])
  }, [datePreset])

  useEffect(() => {
    async function loadData() {
      if (!fromDate || !toDate) return
      setLoading(true)
      try {
        const res = await fetch(`/api/analytics/report?from=${fromDate}&to=${toDate}T23:59:59.999Z`)
        const json = await res.json()
        setData(json)
      } catch (err) {
        toast.error('Failed to load report data')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [fromDate, toDate])

  const handleExportCsv = () => {
    window.location.href = `/api/analytics/report?format=csv&from=${fromDate}&to=${toDate}T23:59:59.999Z`
  }

  const handleExportPdf = () => {
    window.print()
    // TODO: replace with server-side PDF generation (e.g. Puppeteer) for better formatting
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <FileBarChart className="h-6 w-6" />
            Advanced Reports
          </h1>
          <p className="text-muted-foreground mt-1">Exportable metrics and trends.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-muted p-1 rounded-md border border-border">
            <Filter className="h-4 w-4 ml-2 text-muted-foreground" />
            <Select value={datePreset} onValueChange={setDatePreset}>
              <SelectTrigger className="w-[140px] h-8 bg-transparent border-none focus:ring-0">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <Input type="date" className="h-10 w-36" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              <span className="text-muted-foreground">to</span>
              <Input type="date" className="h-10 w-36" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
          )}

          <Button variant="outline" onClick={handleExportCsv} className="ml-auto">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={handleExportPdf}>
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Print header visible only when printing */}
      <div className="hidden print:block mb-8">
        <h1 className="text-3xl font-bold">WhatsApp CRM Analytics Report</h1>
        <p className="text-gray-500">Period: {fromDate} to {toDate}</p>
        <hr className="my-4 border-gray-200" />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="print:hidden">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="broadcasts">Broadcasts</TabsTrigger>
          <TabsTrigger value="inbox">Inbox & Agents</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>
        
        {loading ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">Loading report data...</div>
        ) : (
          <>
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Broadcasts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{data?.broadcasts?.length || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Conversations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{data?.inbox?.length || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">New Contacts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{data?.contacts?.length || 0}</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="broadcasts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Broadcast Performance</CardTitle>
                  <CardDescription>Metrics for all campaigns in the selected period.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="text-sm text-muted-foreground">
                    {data?.broadcasts?.length === 0 ? "No broadcasts in this period." : `${data?.broadcasts?.length} broadcasts processed.`}
                   </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inbox" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Inbox Activity</CardTitle>
                </CardHeader>
                <CardContent>
                   <div className="text-sm text-muted-foreground">
                    {data?.inbox?.length === 0 ? "No conversations in this period." : `${data?.inbox?.length} conversations handled.`}
                   </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contacts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Growth</CardTitle>
                </CardHeader>
                <CardContent>
                   <div className="text-sm text-muted-foreground">
                    {data?.contacts?.length === 0 ? "No new contacts in this period." : `${data?.contacts?.length} new contacts acquired.`}
                   </div>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
