import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import type { ApiErrorCode, ApiResult } from '../lib/api'

export interface ApiResource<T> {
  status: 'loading' | 'ready' | 'error'
  data: T | null
  error: ApiErrorCode | null
  refresh: () => void
  retry: () => void
}

interface ApiResourceOptions {
  enabled?: boolean
  refreshEvery?: number
}

class ApiError extends Error {
  code: ApiErrorCode

  constructor(code: ApiErrorCode) {
    super(code)
    this.code = code
  }
}

const codeOf = (error: unknown): ApiErrorCode =>
  error instanceof ApiError ? error.code : 'network'

export const useApiResource = <T>(
  key: QueryKey,
  load: () => Promise<ApiResult<T>>,
  { enabled = true, refreshEvery }: ApiResourceOptions = {},
): ApiResource<T> => {
  const client = useQueryClient()
  const query = useQuery({
    enabled,
    queryFn: async () => {
      const result = await load()
      if (!result.ok) throw new ApiError(result.error)
      return result.data
    },
    queryKey: key,
    refetchInterval: refreshEvery,
  })

  const refresh = () => void query.refetch({ cancelRefetch: false })
  const retry = () => void client.resetQueries({ exact: true, queryKey: key })
  const controls = { refresh, retry }

  if (query.data !== undefined) {
    const error = query.isError ? codeOf(query.error) : null
    return { status: 'ready', data: query.data, error, ...controls }
  }
  if (query.isError) {
    const error = codeOf(query.error)
    return { status: 'error', data: null, error, ...controls }
  }
  return { status: 'loading', data: null, error: null, ...controls }
}
