import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createQueryClient } from '../lib/queryClient'
import { queryWrapper } from '../test/queryWrapper'
import { useClearDataOnSignOut } from './useClearDataOnSignOut'

describe('useClearDataOnSignOut', () => {
  it('keeps saved data while signed in and drops it on sign-out', () => {
    const client = createQueryClient()
    client.setQueryData(['standing'], { points: 3 })
    const { rerender } = renderHook(
      ({ signedOut }) => useClearDataOnSignOut(signedOut),
      { initialProps: { signedOut: false }, wrapper: queryWrapper(client) },
    )
    expect(client.getQueryData(['standing'])).toEqual({ points: 3 })

    rerender({ signedOut: true })

    expect(client.getQueryData(['standing'])).toBeUndefined()
  })
})
