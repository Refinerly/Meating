# Security Rules & Authorization Policies

## 1. Active Firestore Security Rules (`firestore.rules`)

The following rules are actively enforced on the Cloud Firestore database:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Health / Connection Test path
    match /test/connection {
      allow read: if true;
      allow write: if false;
    }

    // User Profile
    match /users/{userId} {
      allow read: if isOwner(userId);
      allow create, update: if isOwner(userId)
        && request.resource.data.uid == userId
        && request.resource.data.pilotLevel is number
        && request.resource.data.avatarLevel is number
        && request.resource.data.pilotWins is number
        && request.resource.data.avatarWins is number;
      allow delete: if isOwner(userId);

      // Check-ins
      match /checkins/{checkinId} {
        allow read, write: if isOwner(userId);
      }

      // Health Logs
      match /healthLogs/{logId} {
        allow read, write: if isOwner(userId);
      }

      // Projects
      match /projects/{projectId} {
        allow read, write: if isOwner(userId);
      }

      // Missions
      match /missions/{missionId} {
        allow read, write: if isOwner(userId);
      }

      // Quests
      match /quests/{questId} {
        allow read, write: if isOwner(userId);
      }

      // Habits
      match /habits/{habitId} {
        allow read, write: if isOwner(userId);
      }

      // Accounts
      match /accounts/{accountId} {
        allow read, write: if isOwner(userId);
      }

      // Bills
      match /bills/{billId} {
        allow read, write: if isOwner(userId);
      }

      // Expenses
      match /expenses/{expenseId} {
        allow read, write: if isOwner(userId);
      }

      // Wishlist
      match /wishlist/{wishlistId} {
        allow read, write: if isOwner(userId);
      }

      // Settings / Preferences
      match /settings/{settingId} {
        allow read, write: if isOwner(userId);
      }

      // Strava OAuth Tokens
      match /stravaTokens/{tokenId} {
        allow read, write: if isOwner(userId);
      }

      // Analytics Reflections
      match /reflections/{reflectionId} {
        allow read, write: if isOwner(userId);
      }

      // Evaluations
      match /evaluations/{evalId} {
        allow read, write: if isOwner(userId);
      }
    }
  }
}
```

---

## 2. Supabase Row Level Security (RLS) Equivalents

When migrating to Supabase Postgres, enforce RLS policies matching this pattern for all tables:

```sql
-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE strava_tokens ENABLE ROW LEVEL SECURITY;

-- Standard Policy: Users can only read and modify their own records
CREATE POLICY "Users can only access own profiles"
  ON user_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only access own health logs"
  ON health_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only access own checkins"
  ON checkins FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```
