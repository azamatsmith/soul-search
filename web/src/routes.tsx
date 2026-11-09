import type { RouteObject } from 'react-router'
import { AppShell } from './components/AppShell'
import { ScoresScreen } from './screens/ScoresScreen'
import { SightingsScreen } from './screens/SightingsScreen'
import { TakePhotoScreen } from './screens/TakePhotoScreen'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <TakePhotoScreen /> },
      { path: 'sightings', element: <SightingsScreen /> },
      { path: 'scores', element: <ScoresScreen /> },
    ],
  },
]
