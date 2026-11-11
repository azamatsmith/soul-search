import type { CSSProperties } from 'react'
import styles from './RollingCar.module.css'

export interface RollingCarProps {
  progress?: number
  size: 'large' | 'small'
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

export const RollingCar = ({ progress, size }: RollingCarProps) => {
  const parked = progress !== undefined
  const carStyle = parked
    ? ({ '--car-progress': String(clamp(progress)) } as CSSProperties)
    : undefined

  return (
    <span
      aria-hidden="true"
      className={[
        styles.road,
        styles[size],
        parked ? styles.ride : styles.loop,
      ].join(' ')}
    >
      <span
        className={styles.car}
        data-car={parked ? 'parked' : 'looping'}
        style={carStyle}
      >
        <svg aria-hidden="true" className={styles.svg} viewBox="0 0 64 44">
          <path
            className={styles.body}
            d="M8 32V14q0-6 6-6h30q5 0 7 4l6 12q2 3 2 6v2z"
          />
          <rect
            className={styles.glass}
            height="10"
            rx="2"
            width="12"
            x="14"
            y="12"
          />
          <rect
            className={styles.glass}
            height="10"
            rx="2"
            width="13"
            x="29"
            y="12"
          />
          <path className={styles.glass} d="M45 12h3l5 10h-8z" />
          <rect
            className={styles.light}
            height="3"
            rx="1"
            width="5"
            x="52"
            y="26"
          />
          <g className={styles.wheel}>
            <circle className={styles.tire} cx="18" cy="34" r="7" />
            <rect
              className={styles.spoke}
              height="10"
              width="2"
              x="17"
              y="29"
            />
          </g>
          <g className={styles.wheel}>
            <circle className={styles.tire} cx="47" cy="34" r="7" />
            <rect
              className={styles.spoke}
              height="10"
              width="2"
              x="46"
              y="29"
            />
          </g>
        </svg>
      </span>
    </span>
  )
}
