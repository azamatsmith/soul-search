import type { ChangeEvent } from 'react'
import { Button } from '../components/Button'
import { ConnectionError } from '../components/ConnectionError'
import { LoadError } from '../components/LoadError'
import { PlayerSelect } from '../components/PlayerSelect'
import { PushedScreen } from '../components/PushedScreen'
import { Stepper } from '../components/Stepper'
import { TextField } from '../components/TextField'
import { useAdjustScore } from '../hooks/useAdjustScore'
import { periodKicker, pointsNow, saveLabel } from '../lib/adjustCopy'
import styles from './AdjustScoreScreen.module.css'

const MAX_CHANGE = 10
const MAX_REASON_LENGTH = 200

export const AdjustScoreScreen = () => {
  const form = useAdjustScore()
  const { player, scores } = form

  const handleReasonChange = (event: ChangeEvent<HTMLInputElement>) =>
    form.setReason(event.target.value)
  const handleSaveClick = () => {
    void form.save()
  }

  return (
    <PushedScreen
      backLabel="Admin tools"
      backTo="/admin"
      kicker={scores ? periodKicker(scores) : undefined}
      title="Adjust a score"
    >
      {form.status === 'error' && !scores && (
        <LoadError onRetry={form.retry} thing="the players" />
      )}
      {scores && (
        <>
          <PlayerSelect
            onChange={form.setPlayerId}
            players={scores.players}
            value={player?.id ?? null}
          />
          {player && (
            <div className={styles.now}>
              <span className={styles.label}>Points now</span>
              <span className={styles.points}>
                {pointsNow(player, form.change)}
              </span>
            </div>
          )}
          <Stepper
            hint="Use − to take points away"
            label="Change by"
            max={MAX_CHANGE}
            min={-MAX_CHANGE}
            onChange={form.setChange}
            value={form.change}
          />
          <TextField
            hint="Saved in the change history. The player doesn't see it."
            label="Reason (required)"
            maxLength={MAX_REASON_LENGTH}
            onChange={handleReasonChange}
            value={form.reason}
          />
          {form.saveFailed && <ConnectionError kind="save" />}
          <div className={styles.spacer} />
          <Button disabled={!form.canSave} onClick={handleSaveClick}>
            {saveLabel(player, form.change)}
          </Button>
        </>
      )}
    </PushedScreen>
  )
}
