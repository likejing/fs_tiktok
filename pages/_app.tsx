import 'reset-css'
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import Analytics from '../components/Analytics'
import { trackPageView } from '../lib/analytics'

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter()

  // 路由变化时上报页面浏览（用于统计用户数、停留时长等）
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      trackPageView(url, document?.title)
    }
    handleRouteChange(router.asPath)
    router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [router.asPath, router.events])

  return (
    <>
      <Analytics />
      <Component {...pageProps} />
    </>
  )
}

export default MyApp
