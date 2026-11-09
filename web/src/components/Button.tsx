import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'link'
}

export const Button = ({
  variant = 'primary',
  type = 'button',
  className,
  ...buttonProps
}: ButtonProps) => (
  <button
    {...buttonProps}
    type={type}
    className={[styles.button, styles[variant], className]
      .filter(Boolean)
      .join(' ')}
  />
)
