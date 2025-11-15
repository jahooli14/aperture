-- Migration: Fix metadata JSONB update to ensure full replacement
-- This creates an RPC function to atomically update project metadata

CREATE OR REPLACE FUNCTION update_project_metadata(
  p_project_id UUID,
  p_metadata JSONB,
  p_last_active TIMESTAMPTZ DEFAULT now(),
  p_updated_at TIMESTAMPTZ DEFAULT now()
)
RETURNS SETOF projects AS $$
BEGIN
  -- Update with explicit JSONB replacement (not merge)
  RETURN QUERY
  UPDATE projects
  SET
    metadata = p_metadata, -- Full replacement, not merge
    last_active = p_last_active,
    updated_at = p_updated_at
  WHERE projects.id = p_project_id
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_project_metadata TO anon, authenticated;
