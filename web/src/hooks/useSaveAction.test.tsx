import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ApiFailure, ApiResult } from '../lib/api'
import { useSaveAction } from './useSaveAction'

const NETWORK: ApiFailure = { error: 'network', ok: false, status: 0 }
const SAVED: ApiResult<string> = { data: 'saved', ok: true }

describe('useSaveAction', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useSaveAction())
    expect(result.current.saving).toBe(false)
    expect(result.current.failure).toBeNull()
  })

  it('is saving while the request is in flight', async () => {
    const { result } = renderHook(() => useSaveAction())
    let finish: (value: ApiResult<string>) => void = () => {}
    const pending = new Promise<ApiResult<string>>((resolve) => {
      finish = resolve
    })
    let run: Promise<ApiResult<string>> = Promise.resolve(SAVED)
    act(() => {
      run = result.current.run(() => pending)
    })
    expect(result.current.saving).toBe(true)
    await act(async () => {
      finish(SAVED)
      await run
    })
    expect(result.current.saving).toBe(false)
  })

  it('stores the failure and returns it', async () => {
    const { result } = renderHook(() => useSaveAction())
    let returned: ApiResult<string> | null = null
    await act(async () => {
      returned = await result.current.run(() => Promise.resolve(NETWORK))
    })
    expect(result.current.failure?.error).toBe('network')
    expect(returned).toBe(NETWORK)
  })

  it('clears the previous failure on the next run', async () => {
    const { result } = renderHook(() => useSaveAction())
    await act(async () => {
      await result.current.run(() => Promise.resolve(NETWORK))
    })
    await act(async () => {
      await result.current.run(() => Promise.resolve(SAVED))
    })
    expect(result.current.failure).toBeNull()
  })
})
