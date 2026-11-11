import { useState } from 'react'
import { useNavigate } from 'react-router'
import { getPointRules, putPointRules, type PointRules } from '../lib/api'
import { useApiResource } from './useApiResource'
import { useRefreshAll } from './useRefreshAll'

export const usePointRulesForm = () => {
  const resource = useApiResource(['pointRules'], getPointRules)
  const navigate = useNavigate()
  const refreshAll = useRefreshAll()
  const [draft, setDraft] = useState<PointRules | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const rules = draft ?? resource.data

  const update = (change: Partial<PointRules>) => {
    if (rules) setDraft({ ...rules, ...change })
  }

  const handleSave = async () => {
    if (!rules) return
    setSaving(true)
    setSaveFailed(false)
    const result = await putPointRules(rules)
    setSaving(false)
    if (!result.ok) {
      setSaveFailed(true)
      return
    }
    refreshAll()
    void navigate('/admin')
  }

  return {
    handleSave,
    retry: resource.retry,
    rules,
    saveFailed,
    saving,
    status: resource.status,
    update,
  }
}
