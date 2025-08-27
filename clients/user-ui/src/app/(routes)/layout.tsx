'use client'
import { ReactNode, useEffect, useState } from 'react'
import Header from '@/src/components/Layout/Header'
import useUser from '@/src/hooks/useUser';
import { useRouter } from 'next/dist/client/components/navigation';

export default function RouteLayout({ children }: { children: ReactNode }) {
  const [isMinimized, setIsMinimized] = useState(false)
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    const value = sessionStorage.getItem('isMinimized');
    if (value) {setIsMinimized(value === 'true')}
    
    const handler = (event: Event) => {
      const custom = event as CustomEvent
      setIsMinimized(custom.detail) // Update state saat sidebar toggle
    }

    window.addEventListener('sidebar-toggle', handler)
    return () => window.removeEventListener('sidebar-toggle', handler)
  }, [])

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/')
    }
  }, [user, loading, router])

  if (loading || !user) return null;

  return (
    <>
      <Header/>
      <main className={`pt-[60px] ${isMinimized ? 'pl-[60px]' : 'pl-[250px]'} min-h-screen w-full`}>
        {children}
      </main>
    </>
  )
}
