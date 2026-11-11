import { useState } from 'react'
import {
  getAllowedEmails,
  removeAllowedEmail,
  type AllowedEmail,
} from '../lib/api'
import { useApiResource } from './useApiResource'
import { useRefreshAll } from './useRefreshAll'

const byEmail = (a: AllowedEmail, b: AllowedEmail) =>
  a.email.localeCompare(b.email)

export const useAllowedEmails = () => {
  const resource = useApiResource(['allowedEmails'], getAllowedEmails)
  const [edited, setEdited] = useState<AllowedEmail[] | null>(null)
  const [removeFailed, setRemoveFailed] = useState(false)
  const refreshAll = useRefreshAll()
  const loaded = resource.data?.emails ?? []
  const emails = edited ?? resource.data?.emails ?? null

  const handleAdded = (entry: AllowedEmail) => {
    setEdited((current) => [...(current ?? loaded), entry].sort(byEmail))
    refreshAll()
  }

  const handleRemove = async (email: string) => {
    setRemoveFailed(false)
    const result = await removeAllowedEmail(email)
    if (!result.ok) {
      setRemoveFailed(true)
      return
    }
    setEdited((current) =>
      (current ?? loaded).filter((entry) => entry.email !== email),
    )
    refreshAll()
  }

  return {
    emails,
    handleAdded,
    handleRemove,
    removeFailed,
    retry: resource.retry,
    status: resource.status,
  }
}
