// ============================================================
// Domain types – mirrors the database schema
// ============================================================

export type QuestionType = 'MULTIPLE_CHOICE' | 'OPEN' | 'PROGRESSIVE_HINTS' | 'FOLLOW_UP' | 'PAUSE'
export type SessionStatus = 'LOBBY' | 'RUNNING' | 'FINISHED' | 'CANCELLED'
export type MemberRole = 'OWNER' | 'EDITOR'

export interface UserProfile {
  id: string
  display_name: string
  is_admin: boolean
  created_at: string
}

export interface Quiz {
  id: string
  owner_user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface QuizMember {
  quiz_id: string
  user_id: string
  role: MemberRole
  created_at: string
}

export interface Question {
  id: string
  quiz_id: string
  position: number
  type: QuestionType
  text: string | null
  default_points: number | null
  created_at: string
  updated_at: string
}

export interface QuestionOption {
  id: string
  question_id: string
  position: number
  text: string
  is_correct: boolean
}

/** Safe version sent to players – no is_correct */
export interface QuestionOptionSafe {
  id: string
  question_id: string
  position: number
  text: string
}

export interface AcceptedAnswer {
  id: string
  question_id: string
  answer: string
  normalized_answer: string
}

export interface QuestionHint {
  id: string
  question_id: string
  position: number
  text: string
  points: number
}

export interface QuizSession {
  id: string
  quiz_id: string
  host_user_id: string
  join_code: string
  status: SessionStatus
  current_question_id: string | null
  current_hint_index: number | null
  accepting_answers: boolean
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface PlayerProfile {
  id: string
  name: string
  avatar_url: string | null
  user_id: string | null
  created_at: string
}

export interface SessionPlayer {
  id: string
  session_id: string
  player_profile_id: string | null
  display_name: string
  score: number
  joined_at: string
  avatar_url: string | null
}

export interface Answer {
  id: string
  session_id: string
  session_player_id: string
  question_id: string
  answer_text: string | null
  selected_option_id: string | null
  hint_index_at_submission: number | null
  is_correct: boolean | null
  points_awarded: number
  submitted_at: string
  updated_at: string
}

// ============================================================
// Realtime event payloads
// ============================================================
export type RealtimeEventType =
  | 'SESSION_STARTED'
  | 'QUESTION_STARTED'
  | 'QUESTION_CLOSED'
  | 'HINT_REVEALED'
  | 'ANSWER_COUNT_UPDATED'
  | 'SCOREBOARD_UPDATED'
  | 'SESSION_FINISHED'

export interface RealtimeEvent {
  type: RealtimeEventType
  [key: string]: unknown
}

// ============================================================
// Local session storage keys
// ============================================================
export const PLAYER_TOKEN_KEY = 'kvizo_player_token'
export const PLAYER_SESSION_KEY = 'kvizo_session_player_id'
export const PLAYER_SESSION_ID_KEY = 'kvizo_session_id'
