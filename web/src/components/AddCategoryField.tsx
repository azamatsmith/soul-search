import { useState, type ChangeEvent } from 'react'
import { validateCategory } from '../lib/validateCategory'
import { Button } from './Button'
import { TextField } from './TextField'
import styles from './AddCategoryField.module.css'

export interface AddCategoryFieldProps {
  existing: string[]
  onAdd: (name: string) => void
  onCancel: () => void
}

export const AddCategoryField = ({
  existing,
  onAdd,
  onCancel,
}: AddCategoryFieldProps) => {
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value)
    setError(undefined)
  }

  const handleAddClick = () => {
    const trimmed = name.trim()
    const problem = validateCategory(trimmed, existing)
    if (problem) setError(problem)
    else onAdd(trimmed)
  }

  return (
    <div className={styles.field}>
      <TextField
        autoFocus
        error={error}
        label="New category"
        onChange={handleNameChange}
        value={name}
      />
      <div className={styles.actions}>
        <Button onClick={handleAddClick}>Add</Button>
        <Button onClick={onCancel} variant="link">
          Cancel
        </Button>
      </div>
    </div>
  )
}
