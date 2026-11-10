import { Shimmer } from './Shimmer'
import styles from './SightingsPlaceholder.module.css'

const DAYS = [
  { cards: [0, 1, 2], day: 'first' },
  { cards: [0, 1], day: 'second' },
]

export const SightingsPlaceholder = () => (
  <div aria-busy="true" aria-label="Loading sightings" className={styles.list}>
    {DAYS.map(({ cards, day }) => (
      <div className={styles.day} key={day}>
        <Shimmer className={styles.header} />
        {cards.map((card) => (
          <div className={styles.card} key={card}>
            <Shimmer className={styles.photo} />
            <span className={styles.body}>
              <Shimmer className={styles.name} />
              <Shimmer className={styles.claim} />
              <Shimmer className={styles.chip} />
            </span>
          </div>
        ))}
      </div>
    ))}
  </div>
)
