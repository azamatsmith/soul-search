import { useState, type ChangeEvent, type FormEvent } from 'react'
import { putDisplayName, type Me } from '../lib/api'
import {
  validateDisplayName,
  type DisplayNameError,
} from '../lib/validateDisplayName'

type NameError = DisplayNameError | 'name_taken' | 'unavailable'

interface DisplayNameFormOptions {
  initialName: string
  onSaved: (me: Me) => void
}

const nameErrorText = (error: NameError, name: string): string | undefined => {
  switch (error) {
    case 'too_short':
      return 'Names need at least 2 characters.'
    case 'too_long':
      return 'Names can be up to 20 characters.'
    case 'invalid':
      return "Use only letters, numbers, spaces and . ' -"
    case 'name_taken':
      return `Someone already goes by “${name}”. Try adding a last initial, like “${name} K.”`
    default:
      return undefined
  }
}

const serverError = (code: string): NameError => {
  if (code === 'name_taken' || code === 'too_short' || code === 'invalid') {
    return code
  }
  return 'unavailable'
}

export const useDisplayNameForm = ({
  initialName,
  onSaved,
}: DisplayNameFormOptions) => {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<NameError | null>(null)
  const [submittedName, setSubmittedName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value)
    setError(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const checked = validateDisplayName(name)
    if (!checked.ok) {
      setError(checked.error)
      return
    }
    setSaving(true)
    setSubmittedName(checked.name)
    const result = await putDisplayName(checked.name)
    setSaving(false)
    if (result.ok) {
      onSaved(result.data)
    } else {
      setError(serverError(result.error))
    }
  }

  return {
    fieldError: error ? nameErrorText(error, submittedName) : undefined,
    handleNameChange,
    handleSubmit,
    name,
    saving,
    unavailable: error === 'unavailable',
  }
}
