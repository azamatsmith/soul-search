import { ChevronDown } from 'lucide-react'
import { useId, type ChangeEvent } from 'react'
import type { PlayerScore } from '../lib/api'
import { PlayerAvatar } from './PlayerAvatar'
import styles from './PlayerSelect.module.css'

export interface PlayerSelectProps {
  onChange: (playerId: string) => void
  players: PlayerScore[]
  value: string | null
}

export const PlayerSelect = ({
  onChange,
  players,
  value,
}: PlayerSelectProps) => {
  const selectId = useId()
  const picked = players.find((player) => player.id === value)

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) =>
    onChange(event.target.value)

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={selectId}>
        Player
      </label>
      <div className={styles.control}>
        {picked && <PlayerAvatar id={picked.id} name={picked.display_name} />}
        <select
          className={styles.select}
          id={selectId}
          onChange={handleChange}
          value={value ?? ''}
        >
          <option disabled value="">
            Pick a player
          </option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.display_name}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className={styles.chevron} />
      </div>
    </div>
  )
}
