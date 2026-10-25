# Data Model & Schema Specification

All application state is organized in hierarchical Firestore collections rooted under `/users/{userId}`. This ensures complete multi-tenant separation and straightforward security rules.

---

## 1. Collections & Entities

### 1.1 User Profile (`/users/{userId}`)
Stores core gamification attributes, levels, streaks, and check-in configuration.

- **Document Path**: `users/{userId}` (Document ID matches Firebase Auth UID)
- **Permissions**: Read/Write by owner (`request.auth.uid == userId`)
- **Fields**:
  - `uid` (string, required): Firebase user UID
  - `pilotLevel` (number, required): Current level of the Pilot
  - `avatarLevel` (number, required): Current level of the Avatar
  - `pilotWins` (number, required): Total XP accumulated by the Pilot
  - `avatarWins` (number, required): Total XP accumulated by the Avatar
  - `currentStreak` (number, required): Consecutive days of check-in
  - `longestStreak` (number, required): Best recorded streak
  - `checkInTimes` (array of string, required): e.g. `["08:00", "12:00", "18:00"]`
  - `badges` (array of string, required): Unlocked achievement IDs
  - `createdAt` (ISO string, required): Timestamp of creation
  - `updatedAt` (ISO string, required): Timestamp of last modification
- **Example Document**:
  ```json
  {
    "uid": "USER_UID_HERE",
    "pilotLevel": 5,
    "avatarLevel": 3,
    "pilotWins": 1420,
    "avatarWins": 890,
    "currentStreak": 7,
    "longestStreak": 14,
    "checkInTimes": ["08:00", "11:00", "14:00", "18:00"],
    "badges": ["FIRST_CHECKIN", "STREAK_7"],
    "createdAt": "2026-08-01T08:00:00.000Z",
    "updatedAt": "2026-08-21T18:00:00.000Z"
  }
  ```

---

### 1.2 Health Logs (`/users/{userId}/healthLogs/{dateStr}`)
Stores daily health parameters, sleep, body weight, supplements, exercises, and meals.

- **Document Path**: `users/{userId}/healthLogs/{dateStr}` (where `dateStr` is `yyyy-MM-dd`)
- **Permissions**: Read/Write by owner
- **Fields**:
  - `uid` (string, required): User UID
  - `date` (string, required): `yyyy-MM-dd`
  - `weight` (number or string, optional): e.g. `78.5` or `""`
  - `sleepTime` (string, optional): e.g. `"23:30"`
  - `wakeTime` (string, optional): e.g. `"07:00"`
  - `exercises` (array of string, optional): e.g. `["Strava (Ride): Morning commute (12.4km, 32min, 280 kcal)"]`
  - `supplements` (array of `{ name: string, taken: boolean }`, optional)
  - `teas` (array of `{ name: string, taken: boolean }`, optional)
  - `meals` (array of `{ name: string, time: string, calories: number, notes?: string }`, optional)
  - `updatedAt` (ISO string, required)
- **Client Query Patterns**:
  - Direct fetch: `doc(db, 'users', uid, 'healthLogs', dateStr)`
  - Suggestions & Trends: `query(collection(db, 'users', uid, 'healthLogs'), where('date', '>=', sixtyDaysAgo), orderBy('date', 'desc'))`
- **Example Document**:
  ```json
  {
    "uid": "USER_UID_HERE",
    "date": "2026-08-21",
    "weight": 77.8,
    "sleepTime": "23:00",
    "wakeTime": "06:45",
    "exercises": [
      "Strava (Run): Sunset 5k (5.02km, 26min, 340 kcal)"
    ],
    "supplements": [
      { "name": "Creatine 5g", "taken": true },
      { "name": "Vitamin D3 + K2", "taken": true },
      { "name": "Omega 3", "taken": false }
    ],
    "teas": [
      { "name": "Matcha Green Tea", "taken": true },
      { "name": "Chamomile Tea", "taken": false }
    ],
    "meals": [
      {
        "name": "Oatmeal with berries and whey",
        "time": "08:30",
        "calories": 450,
        "notes": "50g oats, 1 scoop whey, blueberries"
      },
      {
        "name": "Chicken breast with quinoa & broccoli",
        "time": "13:15",
        "calories": 620,
        "notes": "200g chicken, 150g quinoa"
      }
    ],
    "updatedAt": "2026-08-21T20:15:00.000Z"
  }
  ```

---

### 1.3 Check-Ins (`/users/{userId}/checkins/{checkinId}`)
Records periodic pilot check-in assessments with 10 vital ratings and qualitative observations.

- **Document Path**: `users/{userId}/checkins/{autoId}`
- **Permissions**: Read/Write by owner
- **Fields**:
  - `uid` (string, required)
  - `timestamp` (ISO string or Firestore Timestamp, required)
  - `stats` (object with 9-10 rating numbers 1-5):
    - `energy`, `mood`, `stress`, `focus`, `social`, `health`, `creative`, `money`, `twitter`, `adherence`
  - `socialBehavior` (string: `"watching"` | `"posting"` | `"neither"`, required)
  - `note` (string, max 2000 chars)
  - `nudgesApplied` (array of string)
- **Client Query Patterns**:
  - `query(collection(db, 'users', uid, 'checkins'))` (sorted client-side or with `orderBy('timestamp', 'desc')`)
- **Example Document**:
  ```json
  {
    "uid": "USER_UID_HERE",
    "timestamp": "2026-08-21T14:00:00.000Z",
    "stats": {
      "adherence": 4,
      "energy": 4,
      "mood": 5,
      "stress": 2,
      "focus": 4,
      "social": 3,
      "health": 4,
      "creative": 5,
      "money": 3,
      "twitter": 1
    },
    "socialBehavior": "neither",
    "note": "Deep work block completed on migration documentation. High focus.",
    "nudgesApplied": ["Take 5 min eye break"]
  }
  ```

---

### 1.4 Projects, Missions & Quests

#### Projects (`/users/{userId}/projects/{projectId}`)
- Fields: `uid`, `title`, `description`, `notionLink?`, `status` (`"Active"` | `"Paused"` | `"Completed"`), `createdAt`
- Example:
  ```json
  {
    "uid": "USER_UID_HERE",
    "title": "Cloudflare & Supabase Migration",
    "description": "Port applet to self-hosted Cloudflare + Supabase infrastructure.",
    "notionLink": "https://notion.so/myworkspace/project-123",
    "status": "Active",
    "createdAt": "2026-08-21T10:00:00.000Z"
  }
  ```

#### Missions (`/users/{userId}/missions/{missionId}`)
- Fields: `uid`, `projectId`, `title`, `description`, `category`, `status` (`"Active"` | `"Paused"` | `"Completed"`), `createdAt`
- Example:
  ```json
  {
    "uid": "USER_UID_HERE",
    "projectId": "PROJECT_ID_HERE",
    "title": "Migrate Firestore to Supabase Postgres",
    "description": "Write SQL DDL and verify foreign key constraints.",
    "category": "Engineering",
    "status": "Active",
    "createdAt": "2026-08-21T11:00:00.000Z"
  }
  ```

#### Quests (`/users/{userId}/quests/{questId}`)
- Daily executable tasks.
- Fields: `uid`, `projectId`, `missionId`, `title`, `dueTime`, `completed` (boolean), `date` (`yyyy-MM-dd`), `createdAt`
- Query Pattern: `query(collection(db, 'users', uid, 'quests'), where('date', '==', todayStr))`
- Example:
  ```json
  {
    "uid": "USER_UID_HERE",
    "projectId": "PROJECT_ID_HERE",
    "missionId": "MISSION_ID_HERE",
    "title": "Execute SQL migration script in Supabase dashboard",
    "dueTime": "16:00",
    "completed": false,
    "date": "2026-08-21",
    "createdAt": "2026-08-21T09:00:00.000Z"
  }
  ```

---

### 1.5 Habits & Habit Logs

#### Habits (`/users/{userId}/habits/{habitId}`)
- Fields: `uid`, `title`, `missionId`, `schedule` (`"daily"`), `streak` (number), `completedDates` (array of `yyyy-MM-dd`), `createdAt`
- Example:
  ```json
  {
    "uid": "USER_UID_HERE",
    "title": "Morning Cold Plunge & Breathwork",
    "missionId": "",
    "schedule": "daily",
    "streak": 12,
    "completedDates": ["2026-08-20", "2026-08-21"],
    "createdAt": "2026-08-01T07:00:00.000Z"
  }
  ```

---

### 1.6 Financial Management Collections

#### Accounts (`/users/{userId}/accounts/{accountId}`)
- Default Accounts: TSB, Nationwide, Halifax, Virgin, Cash
- Fields: `uid`, `name`, `balance` (number), `createdAt`

#### Bills (`/users/{userId}/bills/{billId}`)
- Fields: `uid`, `name`, `amount` (number), `dueDate` (day of month 1-31), `createdAt`

#### Expenses (`/users/{userId}/expenses/{expenseId}`)
- Fields: `uid`, `name`, `amount` (number), `date` (`yyyy-MM-dd`), `createdAt`

#### Wishlist (`/users/{userId}/wishlist/{wishlistId}`)
- Fields: `uid`, `name`, `cost` (number), `imageUrl` (string), `createdAt`

---

### 1.7 Settings & Integrations

#### Settings (`/users/{userId}/settings/preferences`)
- Fields:
  - `checkInSchedule`: array of `{ id: number, time: string, active: boolean }`
  - `notifications`: boolean
  - `weightGoal`: `{ target: number, date: string, startWeight: number, startDate: string }`

#### Strava Tokens (`/users/{userId}/stravaTokens/main`)
- Document ID: `main`
- Fields:
  - `uid` (string)
  - `accessToken` (string)
  - `refreshToken` (string)
  - `expiresAt` (number, epoch timestamp in seconds)
  - `updatedAt` (ISO string)
