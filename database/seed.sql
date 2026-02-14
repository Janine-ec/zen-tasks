-- =============================================================
-- Seed data - default user
-- Run after schema.sql in the Supabase SQL Editor
-- =============================================================

-- Insert a default user (update telegram_chat_id after bot setup)
INSERT INTO users (id, display_name, email, telegram_chat_id, timezone)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Janine',
  'janine@example.com',
  NULL,  -- Set this after getting your Telegram chat ID
  'America/New_York'
)
ON CONFLICT (id) DO NOTHING;
