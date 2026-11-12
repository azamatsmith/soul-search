import type { RouteObject } from 'react-router'
import { AppShell } from './components/AppShell'
import { RedirectIfSignedIn } from './components/RedirectIfSignedIn'
import { RequireAdmin } from './components/RequireAdmin'
import { RequireAuth } from './components/RequireAuth'
import { AdjustScoreScreen } from './screens/AdjustScoreScreen'
import { AdminScreen } from './screens/AdminScreen'
import { AllowedEmailsScreen } from './screens/AllowedEmailsScreen'
import { CaptureScreen } from './screens/CaptureScreen'
import { ChallengeEditScreen } from './screens/ChallengeEditScreen'
import { ChallengesScreen } from './screens/ChallengesScreen'
import { ChangeHistoryScreen } from './screens/ChangeHistoryScreen'
import { ChangeNameScreen } from './screens/ChangeNameScreen'
import { FlaggedPhotosScreen } from './screens/FlaggedPhotosScreen'
import { PastWeekScreen } from './screens/PastWeekScreen'
import { PastWeeksScreen } from './screens/PastWeeksScreen'
import { PointsScreen } from './screens/PointsScreen'
import { ReviewPhotoScreen } from './screens/ReviewPhotoScreen'
import { ScoresScreen } from './screens/ScoresScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SightingsScreen } from './screens/SightingsScreen'
import { SignInPage } from './screens/SignInPage'
import { TakePhotoScreen } from './screens/TakePhotoScreen'
import { UpcomingChallengesScreen } from './screens/UpcomingChallengesScreen'
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
      { path: '/capture', element: <CaptureScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
      { path: '/settings/name', element: <ChangeNameScreen /> },
      { path: '/past-weeks', element: <PastWeeksScreen /> },
      { path: '/past-weeks/:id', element: <PastWeekScreen /> },
      {
        element: <RequireAdmin />,
        children: [
          { path: '/admin', element: <AdminScreen /> },
          { path: '/admin/emails', element: <AllowedEmailsScreen /> },
          { path: '/admin/flagged', element: <FlaggedPhotosScreen /> },
          { path: '/admin/flagged/:id', element: <ReviewPhotoScreen /> },
          { path: '/admin/challenges', element: <ChallengesScreen /> },
          { path: '/admin/challenges/:id', element: <ChallengeEditScreen /> },
          { path: '/admin/points', element: <PointsScreen /> },
          { path: '/admin/adjust', element: <AdjustScoreScreen /> },
          { path: '/admin/history', element: <ChangeHistoryScreen /> },
        ],
      },
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <TakePhotoScreen /> },
          { path: 'sightings', element: <SightingsScreen /> },
          { path: 'scores', element: <ScoresScreen /> },
          { path: 'upcoming', element: <UpcomingChallengesScreen /> },
        ],
      },
    ],
  },
]
