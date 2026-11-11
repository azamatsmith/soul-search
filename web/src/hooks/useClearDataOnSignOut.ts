import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

export const useClearDataOnSignOut = (signedOut: boolean) => {
  const client = useQueryClient()

  useEffect(() => {
    if (signedOut) client.clear()
  }, [client, signedOut])
}
