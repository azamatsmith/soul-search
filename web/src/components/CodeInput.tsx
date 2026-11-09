import type { ChangeEvent } from 'react'
import styles from './CodeInput.module.css'

export const CODE_LENGTH = 6

export interface CodeInputProps {
  value: string
  onChange: (value: string) => void
  onComplete: (code: string) => void
  disabled?: boolean
  invalid?: boolean
}

const BOX_INDEXES = Array.from({ length: CODE_LENGTH }, (_, index) => index)

export const CodeInput = ({
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
}: CodeInputProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (next === value) return
    onChange(next)
    if (next.length === CODE_LENGTH) onComplete(next)
  }

  return (
    <div className={styles.wrapper}>
      <input
        className={styles.input}
        aria-label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        value={value}
        disabled={disabled}
        onChange={handleChange}
      />
      <div
        className={styles.boxes}
        data-testid="code-boxes"
        data-invalid={invalid}
        data-disabled={disabled}
        aria-hidden="true"
      >
        {BOX_INDEXES.map((index) => (
          <span
            key={index}
            data-testid="code-box"
            data-active={!disabled && index === value.length}
            className={styles.box}
          >
            {value[index] ?? ''}
          </span>
        ))}
      </div>
    </div>
  )
}
