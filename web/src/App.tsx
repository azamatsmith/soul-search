import { useApiHealth } from './hooks/useApiHealth'

export const App = () => {
  const status = useApiHealth(import.meta.env.VITE_API_URL)
  const label = status === 'checking' ? 'checking...' : status

  return (
    <main>
      <h1>Soul Search</h1>
      <p>API: {label}</p>
    </main>
  )
}
