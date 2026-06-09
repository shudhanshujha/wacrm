'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ShoppingCart, CheckCircle2, Trash2, ExternalLink } from 'lucide-react'
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

export function ShopifySettings() {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  interface ShopifyConnection {
    id: string
    shop_domain: string
    created_at: string
  }

  interface ShopifyEvent {
    id: string
    event_type: string
    shopify_order_id?: string
    payload: Record<string, unknown>
    status: string
    created_at: string
  }

  const [connection, setConnection] = useState<ShopifyConnection | null>(null)
  const [events, setEvents] = useState<ShopifyEvent[]>([])
  
  const [shopDomain, setShopDomain] = useState('')
  const [accessToken, setAccessToken] = useState('')
  
  // Load connection and events
  useEffect(() => {
    async function load() {
      if (!user) return
      
      const { data: conn } = await supabase
        .from('shopify_connections')
        .select('*')
        .eq('account_id', user.id)
        .single()
        
      setConnection(conn)
      
      if (conn) {
        const { data: evt } = await supabase
          .from('shopify_event_log')
          .select('*')
          .eq('account_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20)
        setEvents(evt || [])
      }
      
      setLoading(false)
    }
    load()
  }, [user, supabase])

  const handleConnect = async () => {
    if (!shopDomain || !accessToken) {
      toast.error('Please fill in both fields')
      return
    }
    
    setConnecting(true)
    try {
      const res = await fetch('/api/integrations/shopify/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: user?.id,
          shopDomain: shopDomain.replace(/^https?:\/\//, '').trim(),
          accessToken: accessToken.trim()
        })
      })
      
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Failed to connect')
      
      toast.success('Successfully connected to Shopify')
      window.location.reload()
    } catch (error) {
      const err = error as Error
      toast.error(err.message || 'Failed to connect')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect? This will stop all automated messages.')) return
    
    setDisconnecting(true)
    try {
      await supabase
        .from('shopify_connections')
        .delete()
        .eq('account_id', user?.id)
        
      toast.success('Disconnected from Shopify')
      window.location.reload()
    } catch {
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

  if (!connection) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            Shopify Integration
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect your store to send automated WhatsApp messages for orders and abandoned carts.
          </p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Connect Your Shopify Store</CardTitle>
            <CardDescription>
              You&apos;ll need a custom app Admin API access token from your Shopify store.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Shopify Store URL</Label>
              <Input 
                id="domain"
                placeholder="e.g. mystore.myshopify.com"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                className="bg-muted border-border"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="token">Admin API Access Token</Label>
              <Input 
                id="token"
                type="password"
                placeholder="shpat_..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
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
                  How to get your Admin API token
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <ol className="list-decimal pl-4 space-y-2">
                    <li>Log in to your Shopify Admin panel.</li>
                    <li>Go to <strong>Settings {'>'} Apps and sales channels</strong>.</li>
                    <li>Click <strong>Develop apps</strong> and then <strong>Create an app</strong>.</li>
                    <li>Name it &quot;WhatsApp CRM&quot; and create.</li>
                    <li>Go to <strong>Configuration</strong> and edit <strong>Admin API integration</strong>.</li>
                    <li>Grant <strong>read_orders</strong> and <strong>read_customers</strong> permissions.</li>
                    <li>Save, then go to <strong>API Credentials</strong> and click <strong>Install app</strong>.</li>
                    <li>Reveal and copy the <strong>Admin API access token</strong> (starts with <code className="bg-muted px-1 rounded">shpat_</code>).</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShoppingCart className="h-6 w-6" />
          Shopify Integration
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your automated WhatsApp notifications for Shopify events.
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
                  <h3 className="text-lg font-semibold text-foreground">{connection.shop_domain}</h3>
                  <a 
                    href={`https://${connection.shop_domain}/admin`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-sm text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    Open Shopify Admin <ExternalLink className="h-3 w-3" />
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
              {/* Template selection UI would go here - placeholder for now */}
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
                  No events received yet. Create a test order in Shopify to see it appear here.
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
                          <TableCell className="text-xs">{event.shopify_order_id}</TableCell>
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
