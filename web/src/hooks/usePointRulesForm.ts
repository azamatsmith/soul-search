import { useState } from 'react'
import { useNavigate } from 'react-router'
import { getPointRules, putPointRules, type PointRules } from '../lib/api'
import { useApiResource } from './useApiResource'

export const usePointRulesForm = () => {
  const resource = useApiResource(getPointRules)
  const navigate = useNavigate()
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
    if (result.ok) void navigate('/admin')
    else setSaveFailed(true)
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
