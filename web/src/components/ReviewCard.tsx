import { Link } from 'react-router'
import type { ReviewItem } from '../lib/api'
import { claimedLine, queueChip } from '../lib/reviewCopy'
import { viewerTime } from '../lib/sightingsCopy'
import { PACIFIC } from '../lib/zonedTime'
import { Photo } from './Photo'
import styles from './ReviewCard.module.css'

export interface ReviewCardProps {
  item: ReviewItem
}

export const ReviewCard = ({ item }: ReviewCardProps) => {
  const chipClass =
    item.status === 'false_call'
      ? `${styles.chip} ${styles.falseCall}`
      : styles.chip

  return (
    <li>
      <Link className={styles.card} to={`/admin/flagged/${item.id}`}>
        <span className={styles.photo}>
          {item.thumb_url && (
            <Photo alt="" className={styles.image} lazy src={item.thumb_url} />
          )}
        </span>
        <span className={styles.body}>
          <span className={styles.top}>
            <span className={styles.name}>{item.display_name}</span>
            <span className={styles.time}>
              {viewerTime(item.taken_at, PACIFIC)}
            </span>
          </span>
          <span className={styles.claim}>{claimedLine(item)}</span>
          {item.check_note && (
            <span className={styles.note}>“{item.check_note}”</span>
          )}
          <span className={chipClass}>{queueChip(item)}</span>
        </span>
      </Link>
    </li>
  )
}
