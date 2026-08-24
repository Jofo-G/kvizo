import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    createQuiz,
    deleteQuiz,
    fetchMyQuizzes,
    fetchQuiz,
    updateQuiz,
} from '../api/quizApi'

export function useMyQuizzes() {
  return useQuery({ queryKey: ['quizzes'], queryFn: fetchMyQuizzes })
}

export function useQuiz(quizId: string) {
  return useQuery({ queryKey: ['quiz', quizId], queryFn: () => fetchQuiz(quizId) })
}

export function useCreateQuiz() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      createQuiz(name, description),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quizzes'] }),
  })
}

export function useUpdateQuiz(quizId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (updates: Parameters<typeof updateQuiz>[1]) => updateQuiz(quizId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quiz', quizId] })
      qc.invalidateQueries({ queryKey: ['quizzes'] })
    },
  })
}

export function useDeleteQuiz() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (quizId: string) => deleteQuiz(quizId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quizzes'] }),
  })
}
