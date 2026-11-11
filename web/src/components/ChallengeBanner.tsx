import { useId } from 'react'
import type { Period } from '../lib/api'
import { bannerBody, bannerTitle } from '../lib/bannerCopy'
import styles from './ChallengeBanner.module.css'

export interface ChallengeBannerProps {
  now: number
  period: Period
}

export const ChallengeBanner = ({ now, period }: ChallengeBannerProps) => {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className={styles.banner}>
      <h2 className={styles.title} id={titleId}>
        {bannerTitle(period.name ?? 'A challenge')}
      </h2>
      <p className={styles.body}>{bannerBody(period, now)}</p>
    </section>
  )
}
