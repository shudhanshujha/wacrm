'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Plus, Trash2, Pencil, CalendarClock } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

export function ScheduledReportsManager() {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<any[]>([])
  
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [formId, setFormId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('full')
  const [formFrequency, setFormFrequency] = useState('weekly')
  const [formEmail, setFormEmail] = useState('')
  const [formActive, setFormActive] = useState(true)

  const loadReports = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('scheduled_reports')
      .select('*')
      .eq('account_id', user.id)
      .order('created_at', { ascending: false })
    
    setReports(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadReports()
  }, [user])

  const openAddModal = () => {
    setFormId(null)
    setFormName('')
    setFormType('full')
    setFormFrequency('weekly')
    setFormEmail(user?.email || '')
    setFormActive(true)
    setModalOpen(true)
  }

  const openEditModal = (report: any) => {
    setFormId(report.id)
    setFormName(report.name)
    setFormType(report.report_type)
    setFormFrequency(report.frequency)
    setFormEmail(report.email)
    setFormActive(report.is_active)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!formName || !formEmail) {
      toast.error('Please fill in all required fields')
      return
    }

    setSaving(true)
    
    const now = new Date()
    let nextSend = new Date(now)
    
    if (formFrequency === 'weekly') {
      nextSend.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7))
      nextSend.setHours(8, 0, 0, 0)
    } else {
      nextSend.setMonth(now.getMonth() + 1)
      nextSend.setDate(1)
      nextSend.setHours(8, 0, 0, 0)
    }

    const payload = {
      account_id: user?.id,
      name: formName,
      report_type: formType,
      frequency: formFrequency,
      email: formEmail,
      is_active: formActive,
      next_send_at: nextSend.toISOString()
    }

    if (formId) {
      await supabase.from('scheduled_reports').update(payload).eq('id', formId)
      toast.success('Report updated')
    } else {
      await supabase.from('scheduled_reports').insert(payload)
      toast.success('Report scheduled')
    }

    setModalOpen(false)
    setSaving(false)
    loadReports()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this scheduled report?')) return
    await supabase.from('scheduled_reports').delete().eq('id', id)
    toast.success('Report deleted')
    loadReports()
  }

  const toggleActive = async (id: string, currentStatus: boolean) => {
    await supabase.from('scheduled_reports').update({ is_active: !currentStatus }).eq('id', id)
    loadReports()
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <CalendarClock className="h-6 w-6" />
            Scheduled Reports
          </h1>
          <p className="text-muted-foreground mt-1">Get automated analytics sent to your inbox.</p>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4 mr-2" />
          Add Report
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No scheduled reports configured.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Send</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.name}</TableCell>
                    <TableCell className="capitalize">{report.report_type}</TableCell>
                    <TableCell className="capitalize">{report.frequency}</TableCell>
                    <TableCell>{report.email}</TableCell>
                    <TableCell>
                      <Switch 
                        checked={report.is_active} 
                        onCheckedChange={() => toggleActive(report.id, report.is_active)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {report.next_send_at ? new Date(report.next_send_at).toLocaleString() : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(report)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(report.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formId ? 'Edit' : 'Add'} Scheduled Report</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Report Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Weekly Executive Summary" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Report Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Report</SelectItem>
                    <SelectItem value="overview">Overview</SelectItem>
                    <SelectItem value="broadcasts">Broadcasts Only</SelectItem>
                    <SelectItem value="inbox">Inbox Only</SelectItem>
                    <SelectItem value="contacts">Contacts Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={formFrequency} onValueChange={setFormFrequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                    <SelectItem value="monthly">Monthly (1st of month)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Recipient Email</Label>
              <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
            </div>
            
            <div className="flex items-center justify-between border border-border p-3 rounded-md bg-muted/50">
              <div>
                <Label className="text-base">Active Status</Label>
                <p className="text-xs text-muted-foreground">Enable or disable this report schedule.</p>
              </div>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
