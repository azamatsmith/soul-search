import styles from './Shimmer.module.css'

export interface ShimmerProps {
  className?: string
  tone?: 'dark' | 'light'
}

export const Shimmer = ({ className, tone = 'light' }: ShimmerProps) => (
  <span
    aria-hidden="true"
    className={[styles.shimmer, styles[tone], className]
      .filter(Boolean)
      .join(' ')}
  />
)
