'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const initialized = useAuthStore((s) => s.initialized)

  useEffect(() => {
    if (!initialized) return
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth')
    if (!user && !isAuthRoute) {
      router.replace('/login')
    } else if (user && isAuthRoute) {
      router.replace('/')
    }
  }, [user, initialized, pathname, router])

  // Wait for session check to complete before rendering anything
  if (!initialized) return null

  return <>{children}</>
}