PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pilot_level INTEGER NOT NULL DEFAULT 1 CHECK (pilot_level >= 1),
  avatar_level INTEGER NOT NULL DEFAULT 1 CHECK (avatar_level >= 1),
  pilot_wins INTEGER NOT NULL DEFAULT 0 CHECK (pilot_wins >= 0),
  avatar_wins INTEGER NOT NULL DEFAULT 0 CHECK (avatar_wins >= 0),
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  check_in_times TEXT NOT NULL DEFAULT '["08:00","12:00","18:00"]' CHECK (json_valid(check_in_times)),
  badges TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(badges)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE checkins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL,
  stats TEXT NOT NULL CHECK (json_valid(stats)),
  social_behavior TEXT NOT NULL DEFAULT 'neither',
  note TEXT NOT NULL DEFAULT '',
  nudges_applied TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(nudges_applied)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX checkins_user_time ON checkins(user_id, timestamp DESC);

CREATE TABLE health_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL CHECK (length(date) = 10),
  weight REAL,
  sleep_time TEXT NOT NULL DEFAULT '',
  wake_time TEXT NOT NULL DEFAULT '',
  exercises TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(exercises)),
  supplements TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(supplements)),
  teas TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(teas)),
  meals TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(meals)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, date)
) STRICT;
CREATE INDEX health_logs_user_date ON health_logs(user_id, date DESC);

CREATE TABLE projects (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', notion_link TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX projects_user ON projects(user_id);

CREATE TABLE missions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX missions_user ON missions(user_id);

CREATE TABLE quests (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT, mission_id TEXT, title TEXT NOT NULL, due_time TEXT NOT NULL DEFAULT '',
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1)), date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX quests_user_date ON quests(user_id, date);

CREATE TABLE habits (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, mission_id TEXT NOT NULL DEFAULT '', schedule TEXT NOT NULL DEFAULT 'daily',
  streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0), completed_dates TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(completed_dates)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX habits_user ON habits(user_id);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, balance REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(user_id, name)
) STRICT;
CREATE INDEX accounts_user ON accounts(user_id);

CREATE TABLE bills (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, amount REAL NOT NULL CHECK (amount >= 0), due_date INTEGER NOT NULL CHECK (due_date BETWEEN 1 AND 31),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX bills_user ON bills(user_id);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, amount REAL NOT NULL CHECK (amount >= 0), date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX expenses_user_date ON expenses(user_id, date DESC);

CREATE TABLE wishlist (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, cost REAL NOT NULL CHECK (cost >= 0), image_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX wishlist_user ON wishlist(user_id);

CREATE TABLE evaluations (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL, evaluation TEXT NOT NULL DEFAULT '', helped TEXT NOT NULL DEFAULT '',
  hurt TEXT NOT NULL DEFAULT '', rule TEXT NOT NULL DEFAULT ''
) STRICT;
CREATE INDEX evaluations_user_time ON evaluations(user_id, timestamp DESC);

CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferences TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(preferences)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

