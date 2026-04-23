-- MoodMeet DB Schema v0.1
-- Run: psql $DATABASE_URL -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  locale        TEXT NOT NULL DEFAULT 'en',
  device_id     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_device_id ON users (device_id);

CREATE TABLE IF NOT EXISTS meetings (
  id              TEXT PRIMARY KEY,
  host_user_id    TEXT NOT NULL REFERENCES users(id),
  title           TEXT,
  status          TEXT NOT NULL CHECK (status IN ('scheduled','live','ended','archived')),
  join_token_hash TEXT NOT NULL,
  password_hash   TEXT,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_meetings_host_created ON meetings (host_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS participants (
  id                  TEXT PRIMARY KEY,
  meeting_id          TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id             TEXT REFERENCES users(id),
  display_name        TEXT NOT NULL,
  role                TEXT NOT NULL CHECK (role IN ('host','cohost','member','guest')),
  weight              NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (weight BETWEEN 0 AND 5),
  consent_expression  BOOLEAN NOT NULL DEFAULT FALSE,
  consent_recording   BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at           TIMESTAMPTZ,
  left_at             TIMESTAMPTZ,
  UNIQUE (meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_meeting ON participants (meeting_id);

CREATE TABLE IF NOT EXISTS mood_series (
  meeting_id      TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  bucket_ts       TIMESTAMPTZ NOT NULL,
  valence_agg     REAL NOT NULL,
  arousal_agg     REAL NOT NULL,
  hue             INTEGER NOT NULL CHECK (hue BETWEEN 0 AND 360),
  sample_count    INTEGER NOT NULL,
  speaker_ptc_id  TEXT REFERENCES participants(id),
  model_version   TEXT NOT NULL,
  PRIMARY KEY (meeting_id, bucket_ts)
);

CREATE INDEX IF NOT EXISTS idx_mood_series_meeting_time ON mood_series (meeting_id, bucket_ts DESC);

CREATE TABLE IF NOT EXISTS utterances (
  id            TEXT PRIMARY KEY,
  meeting_id    TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  ptc_id        TEXT NOT NULL REFERENCES participants(id),
  started_at    TIMESTAMPTZ NOT NULL,
  ended_at      TIMESTAMPTZ NOT NULL,
  transcript    TEXT,
  valence_avg   REAL,
  arousal_avg   REAL
);

CREATE TABLE IF NOT EXISTS meeting_minutes (
  meeting_id    TEXT PRIMARY KEY REFERENCES meetings(id) ON DELETE CASCADE,
  summary_md    TEXT NOT NULL,
  top_moments   JSONB NOT NULL DEFAULT '[]',
  llm_model     TEXT NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
