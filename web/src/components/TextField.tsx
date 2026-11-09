import { useId, type InputHTMLAttributes } from 'react'
import styles from './TextField.module.css'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
  hint?: string
  label: string
}

export const TextField = ({
  className,
  error,
  hint,
  label,
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
        aria-describedby={note ? noteId : undefined}
        aria-invalid={invalid ? true : undefined}
        className={[styles.input, className].filter(Boolean).join(' ')}
        id={inputId}
      />
      {note && (
        <p className={error ? styles.error : styles.hint} id={noteId}>
          {note}
        </p>
      )}
    </div>
  )
}
