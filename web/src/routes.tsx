import type { RouteObject } from 'react-router'
import { AppShell } from './components/AppShell'
import { RedirectIfSignedIn } from './components/RedirectIfSignedIn'
import { RequireAdmin } from './components/RequireAdmin'
import { RequireAuth } from './components/RequireAuth'
import { AdminScreen } from './screens/AdminScreen'
import { ChangeNameScreen } from './screens/ChangeNameScreen'
import { ScoresScreen } from './screens/ScoresScreen'
import { SightingsScreen } from './screens/SightingsScreen'
import { SignInPage } from './screens/SignInPage'
import { TakePhotoScreen } from './screens/TakePhotoScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'

export const routes: RouteObject[] = [
  {
    element: <RedirectIfSignedIn />,
    children: [{ path: '/sign-in', element: <SignInPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/welcome', element: <WelcomeScreen /> },
      { path: '/settings/name', element: <ChangeNameScreen /> },
      {
        element: <RequireAdmin />,
        children: [{ path: '/admin', element: <AdminScreen /> }],
      },
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <TakePhotoScreen /> },
          { path: 'sightings', element: <SightingsScreen /> },
          { path: 'scores', element: <ScoresScreen /> },
        ],
      },
    ],
  },
]
