import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  deleteChallenge,
  getChallenge,
  getChallenges,
  getPointRules,
  postChallenge,
  putChallenge,
  type ApiResult,
  type ChallengeDetail,
  type ChallengeInput,
  type ChallengeRules,
  type PointRules,
} from '../lib/api'
import { challengeErrorText } from '../lib/challengeCopy'
import { isoToPacificFields, pacificToIso } from '../lib/challengeTime'
import { pacificDay } from '../lib/pacificTime'
import { useApiResource } from './useApiResource'
import { useNow } from './useNow'
import { useRefreshAll } from './useRefreshAll'
import { useSaveAction } from './useSaveAction'

export interface ChallengeFields {
  endDate: string
  endTime: string
  name: string
  rules: ChallengeRules
  startDate: string
  startTime: string
}

const LIST = '/admin/challenges'

const nextDay = (key: string) => {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

const newFields = (rules: PointRules, now: number): ChallengeFields => {
  const tomorrow = nextDay(pacificDay(now))
  return {
    endDate: tomorrow,
    endTime: '23:59',
    name: '',
    rules: {
      categories: [],
      false_call: rules.false_call,
      regular: rules.regular,
    },
    startDate: tomorrow,
    startTime: '09:00',
  }
}

const savedFields = (challenge: ChallengeDetail): ChallengeFields => {
  const start = isoToPacificFields(challenge.starts_at)
  const end = isoToPacificFields(challenge.ends_at)
  return {
    endDate: end.date,
    endTime: end.time,
    name: challenge.name,
    rules: challenge.rules,
    startDate: start.date,
    startTime: start.time,
  }
}

const toInput = (
  fields: ChallengeFields,
  lockedStart: string | null,
): ChallengeInput => ({
  ends_at: pacificToIso(fields.endDate, fields.endTime),
  name: fields.name.trim(),
  rules: fields.rules,
  starts_at: lockedStart ?? pacificToIso(fields.startDate, fields.startTime),
})

const hasAllTimes = ({
  endDate,
  endTime,
  startDate,
  startTime,
}: ChallengeFields) => Boolean(endDate && endTime && startDate && startTime)

const noChallenge = (): Promise<ApiResult<ChallengeDetail | null>> =>
  Promise.resolve({ ok: true, data: null })

export const useChallengeForm = (id: string | null) => {
  const navigate = useNavigate()
  const refreshAll = useRefreshAll()
  const now = useNow()
  const weekly = useApiResource(['pointRules'], getPointRules)
  const saved = useApiResource(['challenge', id ?? 'new'], () =>
    id ? getChallenge(id) : noChallenge(),
  )
  const list = useApiResource(['challenges'], getChallenges)
  const [draft, setDraft] = useState<ChallengeFields | null>(null)
  const { failure, run, saving } = useSaveAction()
  const [invalid, setInvalid] = useState<string | null>(null)

  const challenge = saved.data
  const initial = id
    ? challenge && savedFields(challenge)
    : weekly.data && newFields(weekly.data, now)
  const fields = draft ?? initial ?? null
  const finished = challenge ? Date.parse(challenge.ends_at) <= now : false
  const result = list.data?.finished.find((c) => c.id === id)
  const failed = weekly.status === 'error' || saved.status === 'error'

  const update = (change: Partial<ChallengeFields>) => {
    if (fields) setDraft({ ...fields, ...change })
  }

  const finish = async (send: () => Promise<ApiResult<unknown>>) => {
    setInvalid(null)
    const result = await run(send)
    if (!result.ok) return
    refreshAll()
    void navigate(LIST)
  }

  const save = () => {
    if (!fields) return
    if (!hasAllTimes(fields)) {
      setInvalid('Pick a start and end date and time.')
      return
    }
    const lockedStart = challenge?.started ? challenge.starts_at : null
    const input = toInput(fields, lockedStart)
    void finish(() => (id ? putChallenge(id, input) : postChallenge(input)))
  }

  const remove = () => {
    if (id) void finish(() => deleteChallenge(id))
  }

  const retry = () => {
    weekly.retry()
    saved.retry()
  }

  return {
    categories: weekly.data?.categories ?? [],
    error: invalid ?? (failure && challengeErrorText(failure)),
    fields,
    finished,
    loadStatus: failed ? 'error' : fields ? 'ready' : 'loading',
    remove,
    retry,
    save,
    saving,
    started: challenge?.started ?? false,
    update,
    result,
    weekly: weekly.data,
  }
}
