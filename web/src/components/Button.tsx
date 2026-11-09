import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'link' | 'danger'
}

export const Button = ({
  className,
  type = 'button',
  variant = 'primary',
  ...buttonProps
}: ButtonProps) => (
  <button
    {...buttonProps}
    className={[styles.button, styles[variant], className]
      .filter(Boolean)
      .join(' ')}
    type={type}
  />
)
