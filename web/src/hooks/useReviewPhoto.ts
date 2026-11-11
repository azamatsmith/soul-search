import { useNavigate } from 'react-router'
import { getReviewItem, postReview, type ReviewAction } from '../lib/api'
import { useApiResource } from './useApiResource'
import { useRefreshAll } from './useRefreshAll'
import { useSaveAction } from './useSaveAction'

export const useReviewPhoto = (id: string) => {
  const navigate = useNavigate()
  const refreshAll = useRefreshAll()
  const {
    data: item,
    error,
    retry,
    status,
  } = useApiResource(['reviewItem', id], () => getReviewItem(id))
  const { failure, run, saving } = useSaveAction()
  const backTo =
    item?.status === 'false_call'
      ? '/admin/flagged?tab=false_calls'
      : '/admin/flagged'

  const submit = async (action: ReviewAction, category: string | null) => {
    const result = await run(() => postReview(id, action, category))
    if (!result.ok) return
    refreshAll()
    void navigate(backTo, { replace: true })
  }

  return {
    backTo,
    gone: error === 'not_found',
    item,
    retry,
    saveError: failure?.error ?? null,
    saving,
    status,
    submit,
  }
}
