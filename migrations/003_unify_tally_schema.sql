-- Migration to unify tally schema: merge tally_states into stream_configs
-- This solves the issue of having two separate tables for the same functionality

-- Add tally and vmix-related columns to stream_configs table
ALTER TABLE stream_configs ADD COLUMN IF NOT EXISTS tally_program INTEGER;
ALTER TABLE stream_configs ADD COLUMN IF NOT EXISTS tally_preview INTEGER;
ALTER TABLE stream_configs ADD COLUMN IF NOT EXISTS input_list JSONB;
ALTER TABLE stream_configs ADD COLUMN IF NOT EXISTS vmix_version VARCHAR(50);
ALTER TABLE stream_configs ADD COLUMN IF NOT EXISTS vmix_ip INET;
ALTER TABLE stream_configs ADD COLUMN IF NOT EXISTS vmix_tcp_port INTEGER DEFAULT 8099;
ALTER TABLE stream_configs ADD COLUMN IF NOT EXISTS vmix_http_port INTEGER DEFAULT 8088;

-- Migrate existing data from tally_states to stream_configs
-- First, handle sessions that exist in both tables
UPDATE stream_configs 
SET 
    tally_program = ts.program_input,
    tally_preview = ts.preview_input,
    input_list = ts.inputs,
    updated_at = GREATEST(stream_configs.updated_at, ts.updated_at)
FROM tally_states ts 
WHERE stream_configs.session_id = ts.session_id;

-- Insert sessions that exist only in tally_states
INSERT INTO stream_configs (
    session_id, 
    stream_key, 
    tally_program, 
    tally_preview, 
    input_list, 
    created_at, 
    updated_at
)
SELECT 
    ts.session_id,
    CONCAT('stream_', ts.session_id, '_', EXTRACT(EPOCH FROM ts.updated_at)::TEXT), -- Generate unique stream key
    ts.program_input,
    ts.preview_input,
    ts.inputs,
    ts.updated_at,
    ts.updated_at
FROM tally_states ts
LEFT JOIN stream_configs sc ON ts.session_id = sc.session_id
WHERE sc.session_id IS NULL;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_stream_configs_tally_program ON stream_configs(tally_program);
CREATE INDEX IF NOT EXISTS idx_stream_configs_tally_preview ON stream_configs(tally_preview);
CREATE INDEX IF NOT EXISTS idx_stream_configs_vmix_ip ON stream_configs(vmix_ip);

-- Remove old triggers and indexes from tally_states
DROP TRIGGER IF EXISTS update_tally_states_updated_at ON tally_states;
DROP INDEX IF EXISTS idx_tally_states_session;

-- Drop the tally_states table (data already migrated)
DROP TABLE IF EXISTS tally_states;

-- Add comments to document the unified schema
COMMENT ON COLUMN stream_configs.tally_program IS 'Current program (live) input number from vMix';
COMMENT ON COLUMN stream_configs.tally_preview IS 'Current preview input number from vMix';
COMMENT ON COLUMN stream_configs.input_list IS 'JSON object containing all vMix input definitions with numbers, names, and states';
COMMENT ON COLUMN stream_configs.vmix_version IS 'Version of vMix software being used';
COMMENT ON COLUMN stream_configs.vmix_ip IS 'IP address of vMix machine';
COMMENT ON COLUMN stream_configs.vmix_tcp_port IS 'TCP port for vMix API (default 8099)';
COMMENT ON COLUMN stream_configs.vmix_http_port IS 'HTTP port for vMix API (default 8088)';

-- Create a view for backwards compatibility (if needed)
CREATE OR REPLACE VIEW tally_view AS
SELECT 
    session_id,
    tally_program as program_input,
    tally_preview as preview_input,
    input_list as inputs,
    updated_at
FROM stream_configs 
WHERE tally_program IS NOT NULL OR tally_preview IS NOT NULL;

-- Add constraint to ensure session_id in stream_configs matches sessions table
ALTER TABLE stream_configs ADD CONSTRAINT fk_stream_configs_session 
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;

COMMENT ON TABLE stream_configs IS 'Unified table for stream configuration and tally state management';
COMMENT ON VIEW tally_view IS 'Backwards compatibility view for old tally_states table schema';