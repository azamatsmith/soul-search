import type { ChangeEvent, MouseEvent } from 'react'
import { clockText, isFullDateTime, pacificToIso } from '../lib/challengeTime'
import { PACIFIC } from '../lib/zonedTime'
import styles from './DateTimeField.module.css'

export interface DateTimeFieldProps {
  date: string
  disabled?: boolean
  label: string
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  time: string
}

const dateLabel = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: PACIFIC,
  weekday: 'short',
})

const openPicker = (event: MouseEvent<HTMLInputElement>) => {
  try {
    event.currentTarget.showPicker()
  } catch {
    return
  }
}

const shown = (date: string, time: string) => {
  if (!isFullDateTime(date, time))
    return { date: 'Pick a date', time: 'Pick a time' }
  const at = Date.parse(pacificToIso(date, time))
  return { date: dateLabel.format(at), time: clockText(at, PACIFIC) }
}

export const DateTimeField = ({
  date,
  disabled = false,
  label,
  onDateChange,
  onTimeChange,
  time,
}: DateTimeFieldProps) => {
  const display = shown(date, time)
  const handleDateChange = (event: ChangeEvent<HTMLInputElement>) =>
    onDateChange(event.target.value)
  const handleTimeChange = (event: ChangeEvent<HTMLInputElement>) =>
    onTimeChange(event.target.value)

  return (
    <fieldset className={styles.field} disabled={disabled}>
      <legend className={styles.label}>{label}</legend>
      <div className={styles.row}>
        <label className={`${styles.picker} ${styles.date}`}>
          <span aria-hidden className={styles.value}>
            {display.date}
          </span>
          <input
            aria-label={`${label} date`}
            className={styles.input}
            onChange={handleDateChange}
            onClick={openPicker}
            required
            type="date"
            value={date}
          />
        </label>
        <label className={`${styles.picker} ${styles.time}`}>
          <span aria-hidden className={styles.value}>
            {display.time}
          </span>
          <input
            aria-label={`${label} time`}
            className={styles.input}
            onChange={handleTimeChange}
            onClick={openPicker}
            required
            type="time"
            value={time}
          />
        </label>
      </div>
    </fieldset>
  )
}
