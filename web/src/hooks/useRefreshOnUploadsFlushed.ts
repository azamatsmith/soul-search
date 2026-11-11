import { useQueryClient } from '@tanstack/react-query'
import { refreshAfterSighting } from '../lib/refreshAfterSighting'
import { useUploadsFlushed } from './useUploadsFlushed'

export const useRefreshOnUploadsFlushed = () => {
  const client = useQueryClient()
  const handleUploadsFlushed = () => refreshAfterSighting(client)
  useUploadsFlushed(handleUploadsFlushed)
}
