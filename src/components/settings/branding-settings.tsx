'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Palette } from 'lucide-react'

export function BrandingSettings() {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [appName, setAppName] = useState('WhatsApp CRM')
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#7c3aed')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [supportEmail, setSupportEmail] = useState('')

  useEffect(() => {
    async function load() {
      if (!user) return
      
      const { data } = await supabase
        .from('account_branding')
        .select('*')
        .eq('account_id', user.id)
        .single()
        
      if (data) {
        setAppName(data.app_name || 'WhatsApp CRM')
        setLogoUrl(data.logo_url || '')
        setPrimaryColor(data.primary_color || '#7c3aed')
        setFaviconUrl(data.favicon_url || '')
        setSupportEmail(data.support_email || '')
      }
      
      setLoading(false)
    }
    load()
  }, [user, supabase])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        account_id: user?.id,
        app_name: appName,
        logo_url: logoUrl,
        primary_color: primaryColor,
        favicon_url: faviconUrl,
        support_email: supportEmail,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('account_branding')
        .upsert(payload, { onConflict: 'account_id' })
        
      if (error) throw error
      
      toast.success('Branding saved successfully')
      
      // Force reload to apply theme changes globally
      setTimeout(() => window.location.reload(), 1000)
    } catch {
      toast.error('Failed to save branding')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Palette className="h-6 w-6" />
          White-Label Branding
        </h1>
        <p className="text-muted-foreground mt-1">
          Customize the appearance of the CRM for your agency and clients.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Appearance Settings</CardTitle>
          <CardDescription>
            Changes will apply immediately after saving and reloading.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="appName">App Name</Label>
            <Input 
              id="appName"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="e.g. Acme CRM"
              className="bg-muted border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL (Optional)</Label>
            <Input 
              id="logoUrl"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="bg-muted border-border"
            />
            {logoUrl && (
              <div className="mt-2 p-4 bg-muted/50 rounded-md border border-border inline-block">
                <img src={logoUrl} alt="Logo Preview" className="h-10 w-auto object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primary Theme Color</Label>
            <div className="flex items-center gap-3">
              <Input 
                id="primaryColor"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-16 h-10 p-1 cursor-pointer bg-muted border-border"
              />
              <Input 
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-32 bg-muted border-border uppercase"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="faviconUrl">Favicon URL (Optional)</Label>
            <Input 
              id="faviconUrl"
              value={faviconUrl}
              onChange={(e) => setFaviconUrl(e.target.value)}
              placeholder="https://example.com/favicon.ico"
              className="bg-muted border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supportEmail">Support Email</Label>
            <Input 
              id="supportEmail"
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="support@acme.com"
              className="bg-muted border-border"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save Branding
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
