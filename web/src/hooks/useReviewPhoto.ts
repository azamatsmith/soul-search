import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  getReviewItem,
  postReview,
  type ApiErrorCode,
  type ReviewAction,
} from '../lib/api'
import { useApiResource } from './useApiResource'
import { useRefreshAll } from './useRefreshAll'

export const useReviewPhoto = (id: string) => {
  const navigate = useNavigate()
  const refreshAll = useRefreshAll()
  const {
    data: item,
    error,
    retry,
    status,
  } = useApiResource(['reviewItem', id], () => getReviewItem(id))
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
    if (!result.ok) {
      setSaveError(result.error)
      return
    }
    refreshAll()
    void navigate(backTo, { replace: true })
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
