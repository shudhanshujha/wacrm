'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Store, CheckCircle2, Trash2, ExternalLink, AlertTriangle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export function WooCommerceSettings() {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [connection, setConnection] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  
  const [storeUrl, setStoreUrl] = useState('')
  const [consumerKey, setConsumerKey] = useState('')
  const [consumerSecret, setConsumerSecret] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [manualSetupRequired, setManualSetupRequired] = useState(false)
  
  useEffect(() => {
    async function load() {
      if (!user) return
      
      const { data: conn } = await supabase
        .from('woocommerce_connections')
        .select('*')
        .eq('account_id', user.id)
        .single()
        
      setConnection(conn)
      
      if (conn) {
        const { data: evt } = await supabase
          .from('woocommerce_event_log')
          .select('*')
          .eq('account_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20)
        setEvents(evt || [])
      }
      
      setLoading(false)
    }
    load()
  }, [user])

  const handleConnect = async () => {
    if (!storeUrl || !consumerKey || !consumerSecret || !webhookSecret) {
      toast.error('Please fill in all fields')
      return
    }
    
    setConnecting(true)
    try {
      const res = await fetch('/api/integrations/woocommerce/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: user?.id,
          storeUrl: storeUrl.trim(),
          consumerKey: consumerKey.trim(),
          consumerSecret: consumerSecret.trim(),
          webhookSecret: webhookSecret.trim()
        })
      })
      
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Failed to connect')
      
      toast.success('Successfully connected to WooCommerce')
      if (data.manualWebhookSetup) {
        setManualSetupRequired(true)
      } else {
        window.location.reload()
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect? This will stop all automated messages.')) return
    
    setDisconnecting(true)
    try {
      await supabase
        .from('woocommerce_connections')
        .delete()
        .eq('account_id', user?.id)
        
      toast.success('Disconnected from WooCommerce')
      window.location.reload()
    } catch (error) {
      toast.error('Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!connection || manualSetupRequired) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Store className="h-6 w-6" />
            WooCommerce Integration
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect your store to send automated WhatsApp messages for WooCommerce orders.
          </p>
        </div>

        {manualSetupRequired && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2 text-amber-500 font-semibold mb-2">
              <AlertTriangle className="h-5 w-5" />
              Manual Webhook Setup Required
            </div>
            <p className="text-sm text-amber-500/90 mb-4">
              We connected to your store successfully, but your server blocked us from automatically creating the webhooks. Please create them manually in your WordPress admin.
            </p>
            <div className="space-y-2 text-sm text-amber-500/80">
              <p><strong>Delivery URL:</strong> <code className="bg-amber-500/20 px-1 rounded">{process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/woocommerce/webhook</code></p>
              <p><strong>Secret:</strong> <code className="bg-amber-500/20 px-1 rounded">{webhookSecret}</code></p>
              <p>Create webhooks for: <code className="bg-amber-500/20 px-1 rounded">Order created</code>, <code className="bg-amber-500/20 px-1 rounded">Order updated</code>, <code className="bg-amber-500/20 px-1 rounded">Order deleted</code></p>
            </div>
            <Button onClick={() => window.location.reload()} className="mt-4 bg-amber-500 hover:bg-amber-600 text-white">
              I have created the webhooks
            </Button>
          </div>
        )}

        {!manualSetupRequired && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Connect Your WooCommerce Store</CardTitle>
              <CardDescription>
                You'll need to generate REST API keys in your WordPress dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Store URL</Label>
                <Input 
                  id="url"
                  placeholder="e.g. https://mystore.com"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="key">Consumer Key</Label>
                <Input 
                  id="key"
                  type="password"
                  placeholder="ck_..."
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="secret">Consumer Secret</Label>
                <Input 
                  id="secret"
                  type="password"
                  placeholder="cs_..."
                  value={consumerSecret}
                  onChange={(e) => setConsumerSecret(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wh_secret">Webhook Secret (Create your own)</Label>
                <Input 
                  id="wh_secret"
                  placeholder="e.g. my_super_secret_string"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              
              <Button 
                onClick={handleConnect} 
                disabled={connecting}
                className="w-full mt-2"
              >
                {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Connect Store
              </Button>
              
              <Accordion className="w-full mt-6 border border-border rounded-md px-4 bg-muted/50">
                <AccordionItem value="how-to" className="border-none">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline">
                    How to get your WooCommerce API keys
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <ol className="list-decimal pl-4 space-y-2">
                      <li>Log in to your WordPress Admin panel.</li>
                      <li>Go to <strong>WooCommerce {'>'} Settings</strong>.</li>
                      <li>Click the <strong>Advanced</strong> tab, then <strong>REST API</strong>.</li>
                      <li>Click <strong>Add key</strong>.</li>
                      <li>Description: "WhatsApp CRM". Permissions: <strong>Read/Write</strong>.</li>
                      <li>Click Generate API key.</li>
                      <li>Copy the <strong>Consumer Key</strong> and <strong>Consumer Secret</strong>.</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Store className="h-6 w-6" />
          WooCommerce Integration
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your automated WhatsApp notifications for WooCommerce events.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <Card className="bg-card border-border border-green-500/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-2 h-full bg-green-500" />
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-green-500 font-medium">
                    <CheckCircle2 className="h-5 w-5" />
                    Connected
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{connection.store_url}</h3>
                  <a 
                    href={`${connection.store_url}/wp-admin`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-sm text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    Open WordPress Admin <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Disconnect
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Event Templates</CardTitle>
              <CardDescription>Select which WhatsApp templates to send for each event.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-sm text-muted-foreground bg-muted p-4 rounded-md text-center border border-dashed border-border">
                Template mapping UI placeholder (requires fetching templates from Meta API).
                <br/>
                Currently, events are logged but messages will only send if templates are mapped in the database.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1">
          <Card className="bg-card border-border h-full">
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>The last 20 events received from your store.</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No events received yet. Create a test order in WooCommerce to see it appear here.
                </div>
              ) : (
                <div className="rounded-md border border-border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted">
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium text-xs">
                            {event.event_type.replace('_', ' ')}
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(event.created_at).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{event.woo_order_id}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium
                              ${event.status === 'sent' ? 'bg-green-500/10 text-green-500' : 
                                event.status === 'skipped' ? 'bg-slate-500/10 text-slate-500' : 
                                event.status === 'failed' ? 'bg-red-500/10 text-red-500' : 
                                'bg-yellow-500/10 text-yellow-500'}`}>
                              {event.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
