import styles from './SegmentedControl.module.css'

export interface SegmentedControlOption<T extends string> {
  label: string
  value: T
}

export interface SegmentedControlProps<T extends string> {
  label: string
  onChange: (value: T) => void
  options: SegmentedControlOption<T>[]
  value: T
}

export const SegmentedControl = <T extends string>({
  label,
  onChange,
  options,
  value,
}: SegmentedControlProps<T>) => (
  <div aria-label={label} className={styles.track} role="group">
    {options.map((option) => (
      <button
        aria-pressed={option.value === value}
        className={styles.segment}
        key={option.value}
        onClick={() => onChange(option.value)}
        type="button"
      >
        {option.label}
      </button>
    ))}
  </div>
)
