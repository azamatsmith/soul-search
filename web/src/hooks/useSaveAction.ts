import { useState } from 'react'
import type { ApiFailure, ApiResult } from '../lib/api'

export interface SaveAction {
  failure: ApiFailure | null
  run: <T>(send: () => Promise<ApiResult<T>>) => Promise<ApiResult<T>>
  saving: boolean
}

export const useSaveAction = (): SaveAction => {
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<ApiFailure | null>(null)

  const run = async <T>(send: () => Promise<ApiResult<T>>) => {
    setSaving(true)
    setFailure(null)
    const result = await send()
    setSaving(false)
    if (!result.ok) setFailure(result)
    return result
  }

  return { failure, run, saving }
}
