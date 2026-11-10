import { useLocation, useNavigate, useSearchParams } from 'react-router'

const PARAM = 'photo'

interface OpenedState {
  openedPhoto?: boolean
}

export const usePhotoParam = () => {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const openedHere = (location.state as OpenedState | null)?.openedPhoto

  const open = (id: string) =>
    setParams({ [PARAM]: id }, { state: { openedPhoto: true } })

  const close = () => {
    if (openedHere) navigate(-1)
    else setParams({}, { replace: true })
  }

  return { close, open, photoId: params.get(PARAM) }
}
