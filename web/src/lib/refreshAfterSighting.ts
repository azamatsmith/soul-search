import type { QueryClient } from '@tanstack/react-query'

export const refreshAfterSighting = (client: QueryClient) => {
  void client.invalidateQueries({ queryKey: ['standing'] })
  void client.invalidateQueries({ queryKey: ['leaderboard'] })
  void client.invalidateQueries({ queryKey: ['sightings'] })
}
