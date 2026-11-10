import type { DayGroup } from '../lib/sightingsCopy'
import { DayHeader } from './DayHeader'
import { SightingCard } from './SightingCard'
import styles from './SightingsList.module.css'

export interface SightingsListProps {
  groups: DayGroup[]
  onOpen: (id: string) => void
}

export const SightingsList = ({ groups, onOpen }: SightingsListProps) => (
  <div className={styles.days}>
    {groups.map((group) => (
      <section className={styles.day} key={group.header}>
        <DayHeader>{group.header}</DayHeader>
        <ul aria-label={group.header} className={styles.cards}>
          {group.cards.map((card) => (
            <SightingCard card={card} key={card.id} onOpen={onOpen} />
          ))}
        </ul>
      </section>
    ))}
  </div>
)
