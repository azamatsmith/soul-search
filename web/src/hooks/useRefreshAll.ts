import { useQueryClient } from '@tanstack/react-query'

export const useRefreshAll = () => {
  const client = useQueryClient()
  return () => void client.invalidateQueries()
}
