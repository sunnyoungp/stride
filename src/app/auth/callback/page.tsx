'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_IN' && session) {
          router.replace('/')
        } else if (event === 'SIGNED_OUT') {
          router.replace('/login')
        }
      },
    )

    // Timeout fallback — redirect to login if nothing happens
    const timeout = setTimeout(() => {
      setError(true)
      router.replace('/login')
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router])

  return (
    <div className="flex items-center justify-center h-screen">
      <p style={{ color: "var(--fg-muted)", fontSize: 14 }}>
        {error ? "Something went wrong. Redirecting..." : "Signing you in..."}
      </p>
    </div>
  )
}
