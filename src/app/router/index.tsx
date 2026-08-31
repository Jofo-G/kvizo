import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from '../../features/auth/AuthProvider'
import { LoginPage } from '../../features/auth/LoginPage'
import { ProtectedRoute } from '../../features/auth/ProtectedRoute'
import { AdminRoute } from '../../features/auth/AdminRoute'
import { SessionResultsPage } from '../../features/history/components/SessionResultsPage'
import { HostLeaderboardPage } from '../../features/host/components/HostLeaderboardPage'
import { HostSessionPage } from '../../features/host/components/HostSessionPage'
import { JoinPage } from '../../features/player/components/JoinPage'
import { PlayPage } from '../../features/player/components/PlayPage'
import { QuizEditorPage } from '../../features/quiz-editor/components/QuizEditorPage'
import { DashboardPage } from '../../features/quizzes/components/DashboardPage'
import { QuizDetailsPage } from '../../features/quizzes/components/QuizDetailsPage'
import { AdminUsersPage } from '../../features/admin/components/AdminUsersPage'

function AuthCallbackPage() {
  const navigate = useNavigate()
  useEffect(() => {
    // Supabase JS picks up the session from the URL hash automatically.
    // Just redirect to the dashboard after a tick.
    const t = setTimeout(() => navigate('/dashboard', { replace: true }), 100)
    return () => clearTimeout(t)
  }, [navigate])
  return null
}

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
            {/* Public leaderboard display — no auth required */}
            <Route path="/sessions/:sessionId/leaderboard" element={<HostLeaderboardPage />} />
            <Route path="/sessions/:sessionId/results" element={<SessionResultsPage />} />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <AdminUsersPage />
                </AdminRoute>
              }
            />

            {/* Magic link callback — Supabase sets session from URL hash, then redirect */}
            <Route path="/auth/callback" element={<AuthCallbackPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/join" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
