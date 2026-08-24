# Realtime Quiz Companion App — Implementation Brief

## 1. Project Goal

Build and deploy a small realtime web application for private quizzes among friends.

The application is a **companion to Google Slides presentations**.

Google Slides is used only for displaying the visual/question content on a TV/projector.  
The web application handles:

- quiz creation
- quiz sessions
- joining a live quiz
- answering questions
- progressive hints
- realtime state changes
- scoring
- leaderboards
- quiz history
- reusable player names
- multiple quiz creators

This is a private/hobby application for a relatively small group of friends.  
Do not overengineer it.

---

# 2. Recommended Stack

Use:

- **Frontend:** React + TypeScript
- **Build tool:** Vite
- **Styling/UI:** Tailwind CSS + shadcn/ui, or another lightweight React UI library
- **Backend:** Supabase
- **Database:** PostgreSQL through Supabase
- **Authentication:** Supabase Auth
- **Realtime:** Supabase Realtime / Broadcast
- **Frontend deployment:** Vercel
- **Backend/database hosting:** Supabase

The application should initially be a single React application.

Do NOT create:

- microservices
- a separate custom WebSocket server
- a native mobile app
- Google Slides integration
- complex event-sourcing architecture
- a custom authentication system

The database is the source of truth.

Realtime messages should be used to make clients update immediately, but persisted session state must always be recoverable after refresh/reconnect.

---

# 3. High-Level Architecture

```text
                         Supabase
                ┌─────────────────────────┐
                │ PostgreSQL              │
                │ Auth                    │
                │ Realtime / Broadcast    │
                │ Edge Functions if needed│
                └────────────┬────────────┘
                             │
                  HTTP + Realtime events
                             │
             ┌───────────────┴───────────────┐
             │                               │
      Host / Creator UI                Player UI
      React browser app               React browser app
             │                               │
             └──────────── same app ─────────┘


Google Slides
is completely separate and is shown on the projector/TV.
```

---

# 4. Core Product Concept

There are two different concepts:

## Quiz

A reusable quiz definition.

Example:

```text
World of Warcraft Mob Quiz
```

It contains questions and scoring configuration.

## Quiz Session

One actual play-through of a quiz.

Example:

```text
World of Warcraft Mob Quiz
23 August 2026
```

The same quiz can have many historical sessions.

```text
Quiz
 ├── Session 1
 ├── Session 2
 └── Session 3
```

Each session stores:

- participants
- submitted answers
- points
- final ranking
- timestamps
- session state

Historical sessions must remain available after the quiz is finished.

---

# 5. User Types

## Registered User

Registered users are quiz creators/hosts.

Any friend can have an account and create quizzes.

Registered users can:

- create quizzes
- edit quizzes they own or have permission to edit
- start quiz sessions
- host quiz sessions
- view quiz history
- potentially share editing rights with another registered user

Use Supabase Auth.

A simple email magic-link or OTP login is sufficient.

Do not require password management unless necessary.

---

## Player

Players do NOT need an account.

Players participate in individual quiz sessions.

Joining should be extremely simple.

Example:

```text
Room code: 824196

Choose your name:

Jozef
Peter
Martin
Lucia

+ New player
```

Players are represented using reusable `PlayerProfile` records.

---

# 6. Player Identity

The friend group is small and normally uses the same names.

Maintain reusable player profiles:

```text
PlayerProfile
-------------
id
name
user_id nullable
created_at
```

`user_id` is optional.

If a friend also has a registered quiz-creator account, their PlayerProfile may optionally link to that account.

Example:

```text
PlayerProfile:
Peter
user_id = Peter's Supabase user id
```

Someone who only plays:

```text
PlayerProfile:
Martin
user_id = NULL
```

---

# 7. Session Players

Do not attach scores directly to PlayerProfile.

Each session creates a `SessionPlayer`.

```text
SessionPlayer
-------------
id
session_id
player_profile_id
display_name
score
player_token
joined_at
```

This means:

```text
PlayerProfile: Peter

Session A
Peter -> 42 points

Session B
Peter -> 31 points
```

Scores remain isolated per quiz session.

Store `display_name` on SessionPlayer even when linked to PlayerProfile.

This preserves historical names if a PlayerProfile is renamed later.

---

# 8. Player Reconnection

Players should be able to refresh their browser without joining again.

Generate a secure random player token when they join.

Store the token in browser localStorage.

Example:

```text
quiz_player_token = "random-secure-token"
```

The backend maps it to the relevant SessionPlayer.

On reload:

1. read token from localStorage
2. resolve SessionPlayer
3. restore current quiz state
4. reconnect to realtime channel

Do not use the nickname itself as authentication.

---

# 9. Joining Rules

A player enters a room code.

Then show existing PlayerProfiles.

Example:

```text
Choose player

Jozef
Peter
Martin
Lucia
+ New player
```

If a player name is already active in the current session:

```text
Jozef — Joined
```

Do not allow another browser to join as the same SessionPlayer.

Since this is only for friends, this does not need enterprise-level identity protection.

---

# 10. Quiz Ownership and Collaboration

Each quiz has an owner.

```text
Quiz
----
id
owner_user_id
name
description
created_at
updated_at
```

Optionally support collaborators.

Recommended table:

```text
QuizMember
----------
quiz_id
user_id
role
```

Roles:

```text
OWNER
EDITOR
```

This allows:

- Peter creates a quiz
- Jozef can edit it
- Lucia can create another quiz

Do not make all quizzes globally editable.

---

# 11. Quiz Hosting

Quiz creator and quiz host can be different people.

Store:

```text
QuizSession
-----------
id
quiz_id
host_user_id
join_code
status
current_question_id
current_hint_index
accepting_answers
started_at
finished_at
```

Example:

Peter created the quiz.

Jozef hosts it during the evening.

That is valid.

---

# 12. Question Types

Initially support three question types.

```ts
enum QuestionType {
  MultipleChoice = "MULTIPLE_CHOICE",
  Open = "OPEN",
  ProgressiveHints = "PROGRESSIVE_HINTS"
}
```

---

## 12.1 Multiple Choice

Example:

```text
What is the capital of France?

A. London
B. Paris
C. Berlin
D. Madrid
```

Can support ABCD or any small number of options.

Automatic scoring.

---

## 12.2 Open Answer

Example:

```text
What is the capital of France?

[ answer field ]
```

Store one or more accepted answers.

Example:

```text
Paris
PARIS
paris
```

Do not store duplicate casing manually.

Instead normalize answers before matching.

Recommended normalization:

- trim whitespace
- lowercase
- collapse repeated whitespace
- optionally remove simple punctuation

Support an `accepted_answers` list.

Example:

```json
[
  "garrosh",
  "garrosh hellscream",
  "hellscream"
]
```

Host should eventually be able to manually override an answer as correct/incorrect.

---

## 12.3 Progressive Hint Question

This is an important first-class feature.

Example:

```text
Who is this person?

Hint 1
"I was born in 1451."
Correct now = 5 points

Host clicks:
REVEAL NEXT HINT

Hint 2
"I crossed the Atlantic in 1492."
Correct now = 3 points

Host clicks:
REVEAL NEXT HINT

Hint 3
"I sailed for Spain."
Correct now = 1 point
```

Do NOT hardcode exactly two hints.

Model hints generically.

```text
QuestionHint
------------
id
question_id
position
text
points
```

Example:

```json
[
  {
    "position": 1,
    "text": "First clue",
    "points": 5
  },
  {
    "position": 2,
    "text": "Second clue",
    "points": 3
  },
  {
    "position": 3,
    "text": "Third clue",
    "points": 1
  }
]
```

---

# 13. Progressive Hint Answer Behaviour

A player may answer after any revealed hint.

The server must determine how many points the answer is worth.

Do not trust a client-provided points value.

Example:

```text
Player submits while current_hint_index = 1
Correct answer => 5 points

Player submits while current_hint_index = 2
Correct answer => 3 points
```

The submitted answer should store which hint was active at submission time.

```text
Answer
------
...
hint_index_at_submission
points_awarded
```

If desired, define whether a player:

- gets only one answer attempt
- can retry after a wrong answer
- can change an answer until the host closes the question

For MVP, recommended behaviour:

### Multiple choice
Player may change selection while answers are open.  
Only the final submitted/selected answer counts.

### Open
Player may submit/update until answers close.

### Progressive hints
Once a player submits an answer, that submission is locked for that hint stage.

A simple initial implementation may allow one final answer per question.  
Do not build complex attempt tracking unless needed.

---

# 14. Database Model

Recommended starting schema.

---

## users

Supabase Auth owns the actual authenticated user data.

Use `auth.users`.

Optional app-specific profile:

```text
UserProfile
-----------
id UUID PK -> auth.users.id
display_name
created_at
```

---

## quizzes

```text
Quiz
----
id UUID PK
owner_user_id UUID FK
name TEXT
description TEXT nullable
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## quiz_members

```text
QuizMember
----------
quiz_id UUID FK
user_id UUID FK
role TEXT
created_at TIMESTAMP

PK (quiz_id, user_id)
```

---

## questions

```text
Question
--------
id UUID PK
quiz_id UUID FK
position INTEGER
type TEXT
text TEXT nullable
default_points INTEGER nullable
created_at TIMESTAMP
updated_at TIMESTAMP
```

The visible question itself may primarily exist in Google Slides.

Therefore `text` may be short or optional.

It is still useful for quiz management/history.

---

## question_options

```text
QuestionOption
--------------
id UUID PK
question_id UUID FK
position INTEGER
text TEXT
is_correct BOOLEAN
```

Used for multiple-choice questions.

---

## accepted_answers

```text
AcceptedAnswer
--------------
id UUID PK
question_id UUID FK
answer TEXT
normalized_answer TEXT
```

Used for open/progressive questions.

---

## question_hints

```text
QuestionHint
------------
id UUID PK
question_id UUID FK
position INTEGER
text TEXT
points INTEGER
```

Used for progressive-hint questions.

---

## quiz_sessions

```text
QuizSession
-----------
id UUID PK
quiz_id UUID FK
host_user_id UUID FK
join_code TEXT UNIQUE
status TEXT
current_question_id UUID nullable
current_hint_index INTEGER nullable
accepting_answers BOOLEAN
started_at TIMESTAMP nullable
finished_at TIMESTAMP nullable
created_at TIMESTAMP
```

Recommended statuses:

```text
LOBBY
RUNNING
FINISHED
CANCELLED
```

---

## player_profiles

```text
PlayerProfile
-------------
id UUID PK
name TEXT
user_id UUID nullable
created_at TIMESTAMP
```

---

## session_players

```text
SessionPlayer
-------------
id UUID PK
session_id UUID FK
player_profile_id UUID nullable
display_name TEXT
score INTEGER DEFAULT 0
player_token_hash TEXT
joined_at TIMESTAMP
```

Do not store the plaintext token if avoidable.

Hash it before storing.

---

## answers

```text
Answer
------
id UUID PK
session_id UUID FK
session_player_id UUID FK
question_id UUID FK
answer_text TEXT nullable
selected_option_id UUID nullable
hint_index_at_submission INTEGER nullable
is_correct BOOLEAN nullable
points_awarded INTEGER DEFAULT 0
submitted_at TIMESTAMP
updated_at TIMESTAMP
```

Recommended unique constraint:

```text
(session_player_id, question_id)
```

for an MVP with one active answer per player/question.

---

# 15. Scoring

The server/backend is authoritative for scoring.

Never accept:

```json
{
  "points": 5
}
```

from the frontend and write it directly.

Instead the backend derives score using:

- question type
- correct option / accepted answer
- current hint stage
- configured points

For open answers:

```text
normalize(input)
compare against accepted_answers.normalized_answer
```

For multiple choice:

```text
selectedOption.is_correct
```

For progressive hints:

```text
QuestionHint[position = hint_index_at_submission].points
```

---

# 16. Score Storage

Store the final/current score on SessionPlayer for convenient leaderboard reads.

```text
SessionPlayer.score
```

But the score should be reproducible from:

```text
SUM(Answer.points_awarded)
```

When awarding/changing points:

1. update Answer
2. update SessionPlayer score
3. do both transactionally

Do not update only the frontend score.

---

# 17. Realtime

Use Supabase Realtime.

Prefer a session-specific channel.

Example:

```text
quiz-session:{sessionId}
```

Events may include:

```text
SESSION_STARTED
QUESTION_STARTED
QUESTION_CLOSED
HINT_REVEALED
ANSWER_COUNT_UPDATED
QUESTION_REVEALED
SCOREBOARD_UPDATED
SESSION_FINISHED
```

Example event:

```json
{
  "type": "HINT_REVEALED",
  "questionId": "uuid",
  "hintIndex": 2
}
```

---

# 18. Important Realtime Rule

Realtime events are NOT the source of truth.

When host clicks:

```text
Reveal Hint 2
```

first persist:

```text
QuizSession.current_hint_index = 2
```

Then broadcast:

```text
HINT_REVEALED
```

If a player refreshes after missing the broadcast:

```text
GET session state
current_hint_index = 2
```

They still see the correct state.

Follow this pattern for all important host actions.

---

# 19. Host Flow

Typical host flow:

```text
Login
  ↓
My Quizzes
  ↓
Select Quiz
  ↓
Start Session
  ↓
Receive room code
  ↓
Players join
  ↓
Start Quiz
  ↓
Start Question
  ↓
Players answer
  ↓
Reveal hint if progressive question
  ↓
Close answers
  ↓
Reveal result / scoreboard
  ↓
Next question
  ↓
Finish quiz
  ↓
View final leaderboard
```

---

# 20. Player Flow

```text
Open /join
  ↓
Enter room code
  ↓
Choose existing PlayerProfile
or create new name
  ↓
Join lobby
  ↓
Wait for host
  ↓
Question starts
  ↓
Answer
  ↓
Receive hint/realtime changes
  ↓
Question closes
  ↓
See result/score if enabled
  ↓
Next question
  ↓
Final leaderboard
```

---

# 21. Google Slides Integration

For MVP:

**DO NOT integrate with Google Slides API.**

Google Slides is simply the visual presentation.

Typical setup:

```text
Projector / TV
    ↓
Google Slides

Quiz master's laptop
    ↓
Host dashboard

Friends' phones
    ↓
Player UI
```

When changing slides, the host manually presses the corresponding action in the quiz app.

Example:

```text
NEXT QUESTION
```

A Google Slides extension/add-on can be considered later if useful.

It is explicitly out of scope for MVP.

---

# 22. Required Screens

## Public

### Join Session

Route:

```text
/join
```

Contains:

- room code input
- join button

---

### Select Player

Example:

```text
Choose your name

Jozef
Peter
Martin
Lucia

+ New player
```

---

### Player Lobby

Shows:

- quiz/session name
- selected nickname
- waiting state
- list/count of joined players

---

### Player Question

Depending on question type:

Multiple choice:

```text
A
B
C
D
```

Open:

```text
[ answer input ]
[ submit ]
```

Progressive hint:

```text
Current hint

[ answer input ]
[ submit ]
```

Realtime updates when another hint is revealed.

---

### Player Result / Leaderboard

Show current score and optionally ranking.

---

## Authenticated

### Login

Supabase Auth.

---

### Dashboard / My Quizzes

Show:

```text
My Quizzes

World of Warcraft Quiz
Geography Quiz
Movies

+ Create Quiz
```

Can include quizzes shared with the user.

---

### Quiz Editor

Allow:

- quiz name
- description
- add/remove/reorder questions
- change question type
- configure multiple-choice answers
- configure accepted open answers
- configure progressive hints
- configure points

---

### Quiz Details

Show:

- edit quiz
- start new session
- session history

---

### Host Lobby

Show:

```text
ROOM CODE: 824196

Players: 5

Jozef
Peter
Martin
Lucia
Fero

[ START QUIZ ]
```

---

### Host Question Control

Example:

```text
QUESTION 4 / 20

Current hint: 1
18 / 20 players answered

[ REVEAL NEXT HINT ]
[ CLOSE ANSWERS ]
[ REVEAL RESULT ]
[ NEXT QUESTION ]
```

Only show hint controls for progressive questions.

---

### Host Answer Review

Useful for open answers.

Example:

```text
Garrosh Hellscream        ✓
Garosh                    ✓
That angry orc            ✕
Arthas                    ✕
```

Allow host correction/override.

Changing correctness must update points and leaderboard.

---

### Final Results

```text
1. Jozef     62
2. Peter     57
3. Martin    43
```

---

### Quiz History

Example:

```text
World of Warcraft Quiz

23 Aug 2026
18 players
Winner: Peter
[ View session ]

16 Aug 2026
12 players
Winner: Lucia
[ View session ]
```

---

### Historical Session Detail

Show:

- date
- host
- players
- final leaderboard
- individual answers
- points per question

Optional useful view:

```text
Question 7

Correct answer: Stranglethorn Vale

18 players
12 correct
6 incorrect

Jozef   3 pts   Hint 1
Peter   1 pt    Hint 2
Martin  0 pts
```

---

# 23. Scoreboards

Support two concepts.

## Session Scoreboard

This is required for MVP.

```text
1. Jozef   62
2. Peter   57
3. Martin  43
```

---

## All-Time Statistics

Optional later feature.

Because SessionPlayer links back to PlayerProfile, all-time statistics can be calculated later.

Examples:

```text
Player       Games   Wins   Total Points
Jozef          12      4       481
Peter          10      3       429
Martin         12      2       387
```

Do not prioritize this before the MVP works.

---

# 24. Security / Authorization

Use Supabase Row Level Security.

Important rules:

Registered user:

- may create quizzes
- may edit own quizzes
- may edit quizzes where QuizMember role allows editing
- may start/host authorized quizzes
- may read session history for authorized quizzes

Anonymous player:

- may access only the session they joined
- may read safe public session state
- may submit/update only their own answer
- may not modify score
- may not reveal hints
- may not advance questions
- may not edit quizzes
- may not modify another player

Do not expose correct answers to player clients before the host reveals/closes the question.

This is important.

For example, avoid sending:

```json
{
  "option": "B",
  "isCorrect": true
}
```

to player browsers while the question is still active.

---

# 25. Server-Side Operations

Use database functions / Supabase Edge Functions / secure backend operations for actions that need trust boundaries.

Candidates:

```text
joinSession
submitAnswer
revealHint
startQuestion
closeQuestion
scoreAnswer
overrideAnswer
finishSession
```

Especially scoring and host controls should not rely on unrestricted client table writes.

Keep architecture simple, but protect authoritative operations.

---

# 26. Room Codes

Generate short human-friendly room codes.

Example:

```text
824196
```

Recommended:

- 6 digits
- unique among active sessions
- expired/reusable after session ends if desired

Do not use database UUIDs as join codes.

---

# 27. Session State

Persist enough state for every client to fully reconstruct the current quiz after reconnecting.

At minimum:

```text
status
current_question_id
current_hint_index
accepting_answers
```

Potential later fields:

```text
show_scoreboard
show_answer
question_started_at
```

---

# 28. Quiz Question Content

Because the quiz is presented through Google Slides, the web app does not necessarily need to display the full visual question.

A question may therefore contain:

```text
Short label:
"WoW Mob #7"
```

while the actual mob screenshot is visible in Google Slides.

However, the application must still know:

- type
- answer
- options
- hints
- scoring

Player phones should show only what is necessary to answer.

---

# 29. UI Philosophy

This application will primarily be used on:

- phones for players
- laptop for host

Player UI should be extremely simple and mobile-first.

Avoid:

- unnecessary navigation
- dashboards for players
- tiny controls
- excessive text

A player's active question screen should mostly contain the answer controls.

Host UI should prioritize big controls that are hard to click accidentally.

Potentially visually distinguish dangerous actions like:

```text
FINISH SESSION
```

but do not over-design initial implementation.

---

# 30. Suggested Frontend Structure

Use feature-based organization.

Example:

```text
src/
  app/
    router/
    providers/

  features/
    auth/
    quizzes/
      components/
      hooks/
      api/
      types/

    quiz-editor/
      components/
      hooks/

    sessions/
      components/
      hooks/
      api/

    host/
      components/
      hooks/

    player/
      components/
      hooks/

    scoreboard/
      components/

    history/
      components/

  shared/
    components/
    hooks/
    lib/
    types/

  supabase/
    client.ts
```

Do not create excessive layering.

A feature-based structure is preferred over artificial controller/service/repository layers on the frontend.

---

# 31. Suggested Routes

```text
/
  redirect to dashboard or join

/login

/dashboard

/quizzes/new

/quizzes/:quizId

/quizzes/:quizId/edit

/quizzes/:quizId/history

/sessions/:sessionId/host

/sessions/:sessionId/results

/join

/play/:sessionId
```

Adjust if needed.

---

# 32. State Management

Do not introduce Redux unless it becomes clearly useful.

Prefer:

- React Query / TanStack Query for server state
- local component state
- small React context where necessary
- Supabase Realtime subscriptions

Recommended:

```text
TanStack Query
+
Supabase
+
React state
```

---

# 33. MVP

Build in this order.

## Phase 1 — Foundation

- React/Vite project
- Supabase project
- Auth
- schema/migrations
- RLS
- dashboard
- quiz CRUD

---

## Phase 2 — Quiz Editor

- multiple choice questions
- open questions
- progressive hint questions
- accepted answers
- configurable points
- reorder questions

---

## Phase 3 — Sessions

- start session
- generate room code
- join session
- choose/create PlayerProfile
- SessionPlayer creation
- reconnect using token
- host lobby

---

## Phase 4 — Live Quiz

- start question
- submit answers
- reveal progressive hints
- close question
- next question
- realtime updates

---

## Phase 5 — Scoring

- multiple-choice automatic scoring
- normalized open-answer scoring
- progressive hint scoring
- host answer override
- session leaderboard

---

## Phase 6 — History

- finish session
- persist final state
- list historical sessions
- historical leaderboard
- question/answer detail

---

## Phase 7 — Deployment

- deploy frontend to Vercel
- configure production Supabase project
- environment variables
- verify realtime
- verify reconnect behaviour
- test with several phones simultaneously

---

# 34. Explicitly Out of Scope for MVP

Do not implement these unless the core application already works:

- Google Slides API integration
- mobile apps
- push notifications
- chat
- public quiz discovery
- teams
- complex tournament support
- AI grading
- AI quiz generation
- image hosting system
- audio/video questions
- enterprise roles
- OAuth integrations
- complex analytics
- custom WebSocket infrastructure
- microservices
- Redis
- Kubernetes
- NoSQL database

---

# 35. Engineering Principles

When implementing:

1. Prefer the simplest working solution.
2. Keep PostgreSQL as the source of truth.
3. Realtime is a synchronization mechanism, not permanent state.
4. Never trust score calculations sent from clients.
5. Never expose correct answers prematurely.
6. Persist session state so refresh/reconnect always works.
7. Keep player joining frictionless.
8. Keep historical sessions immutable where practical.
9. Do not overabstract early.
10. Write migrations rather than manually changing production schema.
11. Keep quiz definitions separate from played sessions.
12. Keep reusable player identities separate from session participants.

---

# 36. Important Domain Relationships

```text
Auth User
   │
   ├──── creates ─────► Quiz
   │                     │
   │                     ├── Question
   │                     │     ├── QuestionOption
   │                     │     ├── AcceptedAnswer
   │                     │     └── QuestionHint
   │                     │
   │                     └── QuizSession
   │                           │
   │                           ├── SessionPlayer
   │                           │       │
   │                           │       └── Answer
   │                           │
   │                           └── historical result
   │
   └──── optionally linked ───► PlayerProfile

PlayerProfile
   │
   └──── participates through ─► SessionPlayer
```

---

# 37. Example Full Session

Peter creates:

```text
World of Warcraft Quiz
```

He creates:

```text
Question 1
MULTIPLE_CHOICE

Question 2
OPEN

Question 3
PROGRESSIVE_HINTS
Hint 1 -> 5 points
Hint 2 -> 3 points
Hint 3 -> 1 point
```

Peter starts a session.

Server creates:

```text
Room code = 824196
status = LOBBY
```

Friends open:

```text
/join
```

They enter:

```text
824196
```

They choose:

```text
Jozef
Lucia
Martin
Fero
```

Peter presses:

```text
START QUIZ
```

Question 3 starts.

State:

```text
current_question_id = Q3
current_hint_index = 1
accepting_answers = true
```

Jozef submits a correct answer.

Server stores:

```text
hint_index_at_submission = 1
points_awarded = 5
```

Peter presses:

```text
REVEAL NEXT HINT
```

Server persists:

```text
current_hint_index = 2
```

Then broadcasts:

```text
HINT_REVEALED
```

Lucia refreshes her browser.

Even if she missed the realtime event, the app loads the session state and sees:

```text
current_hint_index = 2
```

She sees the correct second hint.

She submits correctly.

Server awards:

```text
3 points
```

Peter closes answers.

Leaderboard is recalculated/updated.

At the end:

```text
status = FINISHED
finished_at = ...
```

All players, answers and scores remain stored and visible in history.

---

# 38. Definition of Done for MVP

The MVP is complete when all of the following work reliably:

- multiple friends can create accounts
- each creator can create quizzes
- quiz supports multiple-choice questions
- quiz supports open-answer questions
- quiz supports progressive-hint questions
- creator can start a live session
- room code is generated
- anonymous players can join
- players can choose an existing name or create a new one
- duplicate active player identity is prevented within a session
- player refresh reconnects correctly
- host can start a question
- players can submit answers
- progressive hints appear in realtime
- hint reveal persists after refresh
- server calculates points
- leaderboard updates correctly
- host can close question / move to next question
- session can finish
- history is stored
- past session leaderboard is viewable
- past answers are viewable
- the application is deployed and usable from multiple phones

---

# 39. Instructions for AI Coding Assistant

When working on this repository:

- Read this document before proposing architecture changes.
- Follow the domain model described here unless there is a concrete technical reason not to.
- If changing the database model, explain what problem the change solves.
- Prefer small incremental changes.
- Do not introduce infrastructure not required by the current task.
- Do not replace PostgreSQL/Supabase unless explicitly requested.
- Do not add Google Slides integration unless explicitly requested.
- Treat authorization, scoring, and answer visibility as security-sensitive.
- Keep migrations synchronized with TypeScript types.
- Prefer generated Supabase database types where practical.
- Keep the application deployable throughout development.
- Add tests for scoring logic and answer normalization.
- Add tests for progressive-hint point calculation.
- Add tests for reconnect/session state behaviour where practical.

If a requirement is unclear, prefer the simplest behaviour consistent with this document rather than inventing a large new feature.
