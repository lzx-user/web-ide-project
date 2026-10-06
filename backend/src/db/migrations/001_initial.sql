CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY,
  access_code_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_saved_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS room_files (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  parent_id UUID NULL REFERENCES room_files(id),
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('file', 'folder')),
  document_key UUID NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  CHECK ((type = 'file' AND document_key IS NOT NULL) OR (type = 'folder' AND document_key IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS room_files_active_path_idx
  ON room_files(room_id, path) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS room_files_parent_idx ON room_files(room_id, parent_id);

CREATE TABLE IF NOT EXISTS yjs_snapshots (
  room_id UUID PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  snapshot BYTEA NOT NULL,
  version BIGINT NOT NULL DEFAULT 1,
  state_vector BYTEA NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
