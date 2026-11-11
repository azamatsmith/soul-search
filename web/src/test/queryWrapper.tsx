import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createQueryClient } from '../lib/queryClient'

interface QueryWrapperProps {
  children: ReactNode
}

export const queryWrapper = (client: QueryClient = createQueryClient()) => {
  const QueryWrapper = ({ children }: QueryWrapperProps) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return QueryWrapper
}
