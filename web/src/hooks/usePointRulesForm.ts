import { useState } from 'react'
import { useNavigate } from 'react-router'
import { getPointRules, putPointRules, type PointRules } from '../lib/api'
import { useApiResource } from './useApiResource'
import { useRefreshAll } from './useRefreshAll'
import { useSaveAction } from './useSaveAction'

export const usePointRulesForm = () => {
  const resource = useApiResource(['pointRules'], getPointRules)
  const navigate = useNavigate()
  const refreshAll = useRefreshAll()
  const [draft, setDraft] = useState<PointRules | null>(null)
  const { failure, run, saving } = useSaveAction()
  const rules = draft ?? resource.data

  const update = (change: Partial<PointRules>) => {
    if (rules) setDraft({ ...rules, ...change })
  }

  const handleSave = async () => {
    if (!rules) return
    const result = await run(() => putPointRules(rules))
    if (!result.ok) return
    refreshAll()
    void navigate('/admin')
  }

  return {
    handleSave,
    retry: resource.retry,
    rules,
    saveFailed: failure !== null,
    saving,
    status: resource.status,
    update,
  }
}
