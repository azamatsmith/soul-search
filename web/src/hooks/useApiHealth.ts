import { useEffect, useState } from 'react'

export type ApiHealthStatus = 'checking' | 'ok' | 'unreachable'

export const useApiHealth = (baseUrl: string | undefined): ApiHealthStatus => {
  const [result, setResult] = useState<{
    baseUrl: string
    status: ApiHealthStatus
  } | null>(null)

  useEffect(() => {
    if (!baseUrl) return
    const controller = new AbortController()
    const url = `${baseUrl.replace(/\/+$/, '')}/health`

    fetch(url, { signal: controller.signal })
      .then((response) => {
        setResult({ baseUrl, status: response.ok ? 'ok' : 'unreachable' })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResult({ baseUrl, status: 'unreachable' })
        }
      })

    return () => controller.abort()
  }, [baseUrl])

  if (!baseUrl) return 'unreachable'
  return result?.baseUrl === baseUrl ? result.status : 'checking'
}
