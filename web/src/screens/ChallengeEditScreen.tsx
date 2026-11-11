import type { ChangeEvent } from 'react'
import { useParams } from 'react-router'
import { BonusEditor } from '../components/BonusEditor'
import { Button } from '../components/Button'
import { ChallengeRuleSteppers } from '../components/ChallengeRuleSteppers'
import { DateTimeField } from '../components/DateTimeField'
import { DeleteChallenge } from '../components/DeleteChallenge'
import { FormError } from '../components/FormError'
import { LoadError } from '../components/LoadError'
import { PushedScreen } from '../components/PushedScreen'
import { TextField } from '../components/TextField'
import { useChallengeForm } from '../hooks/useChallengeForm'
import type { ChallengeRules } from '../lib/api'
import { durationText, pacificToIso } from '../lib/challengeTime'
import type { ChallengeFields } from '../hooks/useChallengeForm'
import styles from './ChallengeEditScreen.module.css'

const runText = (fields: ChallengeFields) => {
  const { endDate, endTime, startDate, startTime } = fields
  if (!startDate || !startTime || !endDate || !endTime) return null
  const start = pacificToIso(startDate, startTime)
  const end = pacificToIso(endDate, endTime)
  return Date.parse(end) > Date.parse(start) ? durationText(start, end) : null
}

export const ChallengeEditScreen = () => {
  const { id } = useParams()
  const challengeId = id && id !== 'new' ? id : null
  const form = useChallengeForm(challengeId)
  const { fields, finished, started, update, weekly } = form

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) =>
    update({ name: event.target.value })
  const handleStartDateChange = (startDate: string) => update({ startDate })
  const handleStartTimeChange = (startTime: string) => update({ startTime })
  const handleEndDateChange = (endDate: string) => update({ endDate })
  const handleEndTimeChange = (endTime: string) => update({ endTime })
  const handleRulesChange = (rules: ChallengeRules) => update({ rules })
  const handleBonusesChange = (bonuses: Record<string, number>) =>
    fields && update({ rules: { ...fields.rules, bonuses } })

  const title = fields?.name.trim() || 'New challenge'
  const duration = fields && runText(fields)

  return (
    <PushedScreen
      backLabel="Challenges"
      backTo="/admin/challenges"
      kicker="Admins only"
      title={title}
    >
      {form.loadStatus === 'error' && (
        <LoadError onRetry={form.retry} thing="the challenge" />
      )}
      {fields && weekly && (
        <>
          {finished && (
            <p className={styles.result}>
              {form.winner
                ? `Won by ${form.winner.display_name} · ${form.winner.points} points`
                : 'Nobody scored'}
            </p>
          )}
          <TextField
            disabled={finished}
            label="Name"
            maxLength={40}
            onChange={handleNameChange}
            value={fields.name}
          />
          <DateTimeField
            date={fields.startDate}
            disabled={started}
            label="Starts"
            onDateChange={handleStartDateChange}
            onTimeChange={handleStartTimeChange}
            time={fields.startTime}
          />
          <DateTimeField
            date={fields.endDate}
            disabled={finished}
            label="Ends"
            onDateChange={handleEndDateChange}
            onTimeChange={handleEndTimeChange}
            time={fields.endTime}
          />
          <p className={styles.timing}>
            <span>All times Pacific</span>
            {duration && <span className={styles.duration}>{duration}</span>}
          </p>
          <p className={styles.note}>
            While it runs, new photos count toward the challenge instead of the
            week.
          </p>
          <h2 className={styles.heading}>Points during the challenge</h2>
          <ChallengeRuleSteppers
            disabled={finished}
            onChange={handleRulesChange}
            rules={fields.rules}
            weekly={weekly}
          />
          <BonusEditor
            bonuses={fields.rules.bonuses}
            categories={form.categories}
            disabled={finished}
            onChange={handleBonusesChange}
            startingBonus={fields.rules.special + 1}
          />
          {form.error && <FormError title={form.error} />}
          {!finished && (
            <Button disabled={form.saving} onClick={form.save}>
              Save challenge
            </Button>
          )}
          {challengeId && (
            <DeleteChallenge
              busy={form.saving}
              name={fields.name}
              onConfirm={form.remove}
            />
          )}
        </>
      )}
    </PushedScreen>
  )
}
