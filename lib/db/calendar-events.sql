-- Additive: creates one new table; nothing existing is altered. Idempotent.
-- (drizzle-kit 0.18 in this repo cannot run `db:push` against drizzle-orm 0.45, so this is applied directly.)
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_date date NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calendar_events_user_date_idx ON calendar_events (user_id, event_date);

-- Calendar page: optional times. Additive and idempotent; existing events become all-day events.
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT true;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS start_time text;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS end_time text;
