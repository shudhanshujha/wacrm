'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useAccountBranding() {
  useEffect(() => {
    const apply = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: branding } = await supabase
        .from('account_branding')
        .select('*')
        .eq('account_id', user.id)
        .single()

      if (!branding) return

      // Apply primary colour as a CSS variable
      document.documentElement.style.setProperty('--primary', branding.primary_color)

      // Apply app name to document title
      document.title = branding.app_name

      // Apply favicon
      if (branding.favicon_url) {
        const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
        if (link) link.href = branding.favicon_url
      }
    }
    apply()
  }, [])
}

// Small client component to run the hook in a server component tree
export function BrandingProvider() {
  useAccountBranding()
  return null
}
