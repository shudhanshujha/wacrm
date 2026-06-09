'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ActingAsBanner() {
  const [actingAs, setActingAs] = useState<string | null>(null)

  useEffect(() => {
    // Read the cookie client-side
    const match = document.cookie.match(new RegExp('(^| )acting_as_account_id=([^;]+)'))
    if (match) {
      const value = match[2]
      setTimeout(() => {
        setActingAs(value)
      }, 0)
    }
  }, [])

  const exitImpersonation = () => {
    document.cookie = 'acting_as_account_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    window.location.href = '/dashboard' // force full reload
  }

  if (!actingAs) return null

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium sticky top-0 z-50 shadow-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        You are currently viewing a client account (Agency Mode).
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-8 hover:bg-amber-600/20 text-amber-950 font-bold"
        onClick={exitImpersonation}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Return to Agency
      </Button>
    </div>
  )
}
