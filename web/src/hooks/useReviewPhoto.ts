import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  getReviewItem,
  postReview,
  type ApiErrorCode,
  type ReviewAction,
} from '../lib/api'
import { useApiResource } from './useApiResource'

export const useReviewPhoto = (id: string) => {
  const navigate = useNavigate()
  const load = useCallback(() => getReviewItem(id), [id])
  const { data: item, error, retry, status } = useApiResource(load)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<ApiErrorCode | null>(null)
  const backTo =
    item?.status === 'false_call'
      ? '/admin/flagged?tab=false_calls'
      : '/admin/flagged'

  const submit = async (action: ReviewAction, category: string | null) => {
    setSaving(true)
    setSaveError(null)
    const result = await postReview(id, action, category)
    setSaving(false)
    if (result.ok) void navigate(backTo, { replace: true })
    else setSaveError(result.error)
  }

  return {
    backTo,
    gone: error === 'not_found',
    item,
    retry,
    saveError,
    saving,
    status,
    submit,
  }
}
