import type { ChangeEvent } from 'react'
import styles from './CodeInput.module.css'

export const CODE_LENGTH = 6

export interface CodeInputProps {
  disabled?: boolean
  invalid?: boolean
  onChange: (value: string) => void
  onComplete: (code: string) => void
  readOnly?: boolean
  value: string
}

const BOX_INDEXES = Array.from({ length: CODE_LENGTH }, (_, index) => index)

const sharedPrefixLength = (a: string, b: string) => {
  let length = 0
  while (length < a.length && a[length] === b[length]) length += 1
  return length
}

const insertedDigits = (previous: string, digits: string) => {
  const prefix = sharedPrefixLength(previous, digits)
  let suffix = 0
  while (
    prefix + suffix < previous.length &&
    previous[previous.length - 1 - suffix] ===
      digits[digits.length - 1 - suffix]
  ) {
    suffix += 1
  }
  return digits.slice(prefix, digits.length - suffix)
}

const nextCode = (previous: string, raw: string) => {
  const digits = raw.replace(/\D/g, '')
  const inserted = insertedDigits(previous, digits)
  if (previous && inserted.length >= CODE_LENGTH) {
    return inserted.slice(0, CODE_LENGTH)
  }
  return digits.slice(0, CODE_LENGTH)
}

export const CodeInput = ({
  disabled = false,
  invalid = false,
  onChange,
  onComplete,
  readOnly = false,
  value,
}: CodeInputProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = nextCode(value, event.target.value)
    if (next === value) return
    onChange(next)
    if (next.length === CODE_LENGTH) onComplete(next)
  }

  return (
    <div className={styles.wrapper}>
      <input
        aria-label="6-digit code"
        autoComplete="one-time-code"
        autoFocus
        className={styles.input}
        disabled={disabled}
        inputMode="numeric"
        onChange={handleChange}
        readOnly={readOnly}
        value={value}
      />
      <div
        aria-hidden="true"
        className={styles.boxes}
        data-disabled={disabled}
        data-invalid={invalid}
        data-testid="code-boxes"
      >
        {BOX_INDEXES.map((index) => (
          <span
            className={styles.box}
            data-active={!disabled && index === value.length}
            data-testid="code-box"
            key={index}
          >
            {value[index] ?? ''}
          </span>
        ))}
      </div>
    </div>
  )
}
