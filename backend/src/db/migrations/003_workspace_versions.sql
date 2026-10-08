CREATE TABLE IF NOT EXISTS workspace_versions (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_by TEXT NOT NULL,
  snapshot BYTEA NOT NULL,
  file_tree JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_versions_room_created_idx
  ON workspace_versions(room_id, created_at DESC);
