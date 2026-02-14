-- =============================================================
-- Task Management App - Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================

-- 1. Custom types
-- ---------------------------------------------------------
CREATE TYPE task_status    AS ENUM ('pending', 'in_progress', 'completed', 'deleted');
CREATE TYPE energy_level   AS ENUM ('low', 'medium', 'high');
CREATE TYPE nudge_channel  AS ENUM ('telegram', 'in_app', 'email');
CREATE TYPE nudge_status   AS ENUM ('sent', 'accepted', 'dismissed', 'expired');


-- 2. Helper: auto-update updated_at
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================
-- TABLES
-- =============================================================

-- 3. users
-- ---------------------------------------------------------
CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name     TEXT NOT NULL,
  email            TEXT UNIQUE,
  telegram_chat_id TEXT,
  timezone         TEXT NOT NULL DEFAULT 'UTC',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- 4. tasks
-- ---------------------------------------------------------
CREATE TABLE tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Original input (never lost)
  raw_input         TEXT NOT NULL,

  -- AI-parsed fields
  title             TEXT NOT NULL,
  description       TEXT,

  -- Eisenhower matrix dimensions (1 = lowest, 5 = highest)
  urgency           INTEGER NOT NULL DEFAULT 3 CHECK (urgency BETWEEN 1 AND 5),
  importance        INTEGER NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),

  -- Scheduling
  due_date          TIMESTAMPTZ,
  estimated_minutes INTEGER,
  energy_level      energy_level DEFAULT 'medium',
  can_be_split      BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence        TEXT,           -- e.g. "weekly", "every Monday", null if one-off

  -- Context
  location          TEXT,           -- null = anywhere, otherwise "office", "home", etc.
  depends_on        UUID REFERENCES tasks(id) ON DELETE SET NULL,
  tags              TEXT[] DEFAULT '{}',

  -- Status & follow-up
  status            task_status NOT NULL DEFAULT 'pending',
  snoozed_until     TIMESTAMPTZ,    -- task hidden from top tasks until this time
  follow_up_at      TIMESTAMPTZ,    -- set when user says "I'm about to do it"

  -- AI conversation history for this task
  ai_conversation   JSONB DEFAULT '[]',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_user_status  ON tasks(user_id, status);
CREATE INDEX idx_tasks_due_date     ON tasks(due_date)     WHERE status = 'pending';
CREATE INDEX idx_tasks_follow_up    ON tasks(follow_up_at) WHERE follow_up_at IS NOT NULL AND status = 'in_progress';
CREATE INDEX idx_tasks_depends_on   ON tasks(depends_on)   WHERE depends_on IS NOT NULL;
CREATE INDEX idx_tasks_snoozed      ON tasks(snoozed_until) WHERE snoozed_until IS NOT NULL AND status = 'pending';

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- 5. nudges
-- ---------------------------------------------------------
CREATE TABLE nudges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  channel       nudge_channel NOT NULL DEFAULT 'telegram',
  message_text  TEXT NOT NULL,
  calendar_slot JSONB,
  status        nudge_status  NOT NULL DEFAULT 'sent',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nudges_user_status ON nudges(user_id, status);

CREATE TRIGGER nudges_updated_at
  BEFORE UPDATE ON nudges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- 6. notifications (for future in-app use; Realtime-ready)
-- ---------------------------------------------------------
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nudge_id   UUID REFERENCES nudges(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read = FALSE;

CREATE TRIGGER notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =============================================================
-- ROW LEVEL SECURITY
-- Using (true) for now; tighten to auth.uid() = user_id later
-- =============================================================

ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE nudges        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_all"         ON users         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tasks_all"         ON tasks         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "nudges_all"        ON nudges        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "notifications_all" ON notifications FOR ALL USING (true) WITH CHECK (true);


-- =============================================================
-- REALTIME (enable for notifications table)
-- =============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
