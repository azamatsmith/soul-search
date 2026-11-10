import styles from './ToggleSwitch.module.css'

export interface ToggleSwitchProps {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (checked: boolean) => void
}

export const ToggleSwitch = ({
  checked,
  disabled,
  label,
  onChange,
}: ToggleSwitchProps) => {
  const handleClick = () => onChange(!checked)

  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={styles.track}
      disabled={disabled}
      onClick={handleClick}
      role="switch"
      type="button"
    >
      <span className={styles.knob} />
    </button>
  )
}
