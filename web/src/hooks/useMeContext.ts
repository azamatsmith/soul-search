import { useOutletContext } from 'react-router'
import type { Me } from '../lib/api'

export interface MeOutletContext {
  me: Me
  setMe: (me: Me) => void
}

export const useMeContext = () => useOutletContext<MeOutletContext>()
