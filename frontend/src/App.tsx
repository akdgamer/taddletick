import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { DashboardPage } from './components/DashboardPage'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>
  )
}
