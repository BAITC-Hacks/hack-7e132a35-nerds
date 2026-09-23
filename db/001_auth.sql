CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  login varchar(40) NOT NULL UNIQUE CHECK (login = lower(login)),
  display_name varchar(80) NOT NULL,
  password_hash text NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'participant' CHECK (role IN ('participant','admin')),
  disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_limits (
  key varchar(100) PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
