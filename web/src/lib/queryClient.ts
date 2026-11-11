import { QueryClient } from '@tanstack/react-query'

const THIRTY_MINUTES = 30 * 60_000

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: THIRTY_MINUTES,
        retry: false,
        staleTime: 0,
      },
    },
  })

export const queryClient = createQueryClient()
