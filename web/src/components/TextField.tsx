import { useId, type InputHTMLAttributes } from 'react'
import styles from './TextField.module.css'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
}

export const TextField = ({
  label,
  hint,
  error,
  className,
  ...inputProps
}: TextFieldProps) => {
  const inputId = useId()
  const noteId = useId()
  const note = error ?? hint
  const invalid =
    error !== undefined || String(inputProps['aria-invalid']) === 'true'

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        {...inputProps}
        id={inputId}
        className={[styles.input, className].filter(Boolean).join(' ')}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={note ? noteId : undefined}
      />
      {note && (
        <p id={noteId} className={error ? styles.error : styles.hint}>
          {note}
        </p>
      )}
    </div>
  )
}
