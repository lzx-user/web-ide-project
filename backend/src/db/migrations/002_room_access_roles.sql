CREATE TABLE IF NOT EXISTS room_access_codes (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  access_code_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, role)
);

-- Existing rooms keep their historical access code and editor permissions.
INSERT INTO room_access_codes (room_id, role, access_code_hash)
SELECT id, 'editor', access_code_hash FROM rooms
WHERE access_code_hash IS NOT NULL
ON CONFLICT (room_id, role) DO NOTHING;
