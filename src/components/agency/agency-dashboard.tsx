'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Plus, Users, ArrowRightLeft } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { useRouter } from 'next/navigation'

export function AgencyDashboard({ isInitialAgency }: { isInitialAgency?: boolean }) {
  const { user } = useAuth()
  const supabase = createClient()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<any[]>([])
  const [isAgency, setIsAgency] = useState(isInitialAgency || false)
  
  const [modalOpen, setModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')

  const loadClients = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('agency_accounts')
      .select('*')
      .eq('agency_id', user.id)
      .order('created_at', { ascending: false })
    
    setClients(data || [])
    if (data && data.length > 0) setIsAgency(true)
    setLoading(false)
  }

  useEffect(() => {
    loadClients()
  }, [user])

  const handleCreate = async () => {
    if (!formName || !formEmail) {
      toast.error('Please fill in all required fields')
      return
    }

    setCreating(true)
    
    try {
      const res = await fetch('/api/agency/create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formEmail, clientName: formName })
      })

      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Failed to create client')
      
      toast.success('Client created successfully. A password reset link has been generated.')
      setModalOpen(false)
      loadClients()
      setIsAgency(true)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (id: string, currentStatus: boolean) => {
    await supabase.from('agency_accounts').update({ is_active: !currentStatus }).eq('id', id)
    loadClients()
  }

  const switchToClient = (clientId: string) => {
    // We set the acting_as_account_id via a query param redirect so middleware picks it up
    router.push(`/dashboard?acting_as=${clientId}`)
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAgency && clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Users className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Agency Mode</h2>
        <p className="text-muted-foreground max-w-md text-center">
          Manage multiple client accounts from a single dashboard. 
          Create your first client account to enable Agency Mode.
        </p>
        <Button onClick={() => setModalOpen(true)}>Enable Agency Mode</Button>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create First Client Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Client Business Name</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Acme Corp" />
              </div>
              <div className="space-y-2">
                <Label>Client Email</Label>
                <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="hello@acme.com" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Create Client
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <Users className="h-6 w-6" />
            Client Accounts
          </h1>
          <p className="text-muted-foreground mt-1">Manage and access your client's CRM dashboards.</p>
        </div>
        <Button onClick={() => {
          setFormName('')
          setFormEmail('')
          setModalOpen(true)
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.client_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(client.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={client.is_active} 
                      onCheckedChange={() => toggleActive(client.id, client.is_active)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => switchToClient(client.client_id)}
                      className="border-primary text-primary hover:bg-primary hover:text-white"
                      disabled={!client.is_active}
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      Switch to Account
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Client Business Name</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Acme Corp" />
            </div>
            
            <div className="space-y-2">
              <Label>Client Admin Email</Label>
              <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="admin@acme.com" />
              <p className="text-xs text-muted-foreground mt-1">We will generate an account and they can reset their password later.</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
