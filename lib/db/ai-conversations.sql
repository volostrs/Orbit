-- Additive: creates two new tables only; nothing existing is altered. Idempotent.
-- (drizzle-kit 0.18 in this repo cannot run `db:push` against drizzle-orm 0.45, so this is applied directly.)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  title text NOT NULL,
  slot smallint NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT ai_conversations_note_slot_unique UNIQUE (note_id, slot),
  CONSTRAINT ai_conversations_slot_range CHECK (slot BETWEEN 1 AND 3)
);
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  seq bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  role text NOT NULL,
  kind text,
  content text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_messages_conversation_seq_idx ON ai_messages (conversation_id, seq);
