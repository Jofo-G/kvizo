import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { LoginPage } from '../../features/auth/LoginPage'
import { ProtectedRoute } from '../../features/auth/ProtectedRoute'
import { SessionResultsPage } from '../../features/history/components/SessionResultsPage'
import { HostSessionPage } from '../../features/host/components/HostSessionPage'
import { JoinPage } from '../../features/player/components/JoinPage'
import { PlayPage } from '../../features/player/components/PlayPage'
import { QuizEditorPage } from '../../features/quiz-editor/components/QuizEditorPage'
import { DashboardPage } from '../../features/quizzes/components/DashboardPage'
import { QuizDetailsPage } from '../../features/quizzes/components/QuizDetailsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
})

export function AppRouter() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Navigate to="/join" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/join" element={<JoinPage />} />
            <Route path="/play/:sessionId" element={<PlayPage />} />

            {/* Authenticated */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes/:quizId"
              element={
                <ProtectedRoute>
                  <QuizDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes/:quizId/edit"
              element={
                <ProtectedRoute>
                  <QuizEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sessions/:sessionId/host"
              element={
                <ProtectedRoute>
                  <HostSessionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sessions/:sessionId/results"
              element={
                <ProtectedRoute>
                  <SessionResultsPage />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/join" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
