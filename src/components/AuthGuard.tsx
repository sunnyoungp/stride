'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth')
    if (!user && !isAuthRoute) {
      router.replace('/login')
    }
    setChecking(false)
  }, [user, pathname, router])

  if (checking) return null

  return <>{children}</>
}