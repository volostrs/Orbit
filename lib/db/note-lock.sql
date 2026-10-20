-- Additive and idempotent: existing notes become unlocked. Applied directly like calendar-events.sql.
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
