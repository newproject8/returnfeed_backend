-- Add PD-specific columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pd BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pd_software_version VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_pd_login TIMESTAMP;

-- Create PD software registration table
CREATE TABLE IF NOT EXISTS pd_software_registrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    software_version VARCHAR(50) NOT NULL,
    machine_id VARCHAR(255),
    ip_address INET,
    vmix_port INTEGER DEFAULT 8088,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, machine_id)
);

-- Create stream configurations table
CREATE TABLE IF NOT EXISTS stream_configs (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    stream_key VARCHAR(255) UNIQUE NOT NULL,
    srt_port INTEGER DEFAULT 8890,
    srt_passphrase VARCHAR(255),
    webrtc_enabled BOOLEAN DEFAULT true,
    hls_enabled BOOLEAN DEFAULT true,
    recording_enabled BOOLEAN DEFAULT false,
    bitrate INTEGER DEFAULT 5000, -- in kbps
    resolution VARCHAR(20) DEFAULT '1920x1080',
    framerate INTEGER DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id)
);

-- Create stream metrics table for monitoring
CREATE TABLE IF NOT EXISTS stream_metrics (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    bitrate_actual INTEGER,
    framerate_actual INTEGER,
    packet_loss DECIMAL(5,2),
    latency INTEGER, -- in milliseconds
    viewer_count INTEGER DEFAULT 0,
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    network_usage DECIMAL(10,2) -- in Mbps
);

-- Create audit log table for compliance
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_pd_registrations_user ON pd_software_registrations(user_id);
CREATE INDEX idx_pd_registrations_active ON pd_software_registrations(is_active);
CREATE INDEX idx_stream_configs_session ON stream_configs(session_id);
CREATE INDEX idx_stream_metrics_session ON stream_metrics(session_id);
CREATE INDEX idx_stream_metrics_timestamp ON stream_metrics(timestamp);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Add triggers for updated_at
CREATE TRIGGER update_stream_configs_updated_at BEFORE UPDATE
    ON stream_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add function to clean old metrics (keep last 7 days)
CREATE OR REPLACE FUNCTION clean_old_metrics() RETURNS void AS $$
BEGIN
    DELETE FROM stream_metrics WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '7 days';
    DELETE FROM audit_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean old metrics (requires pg_cron extension)
-- SELECT cron.schedule('clean-old-metrics', '0 2 * * *', 'SELECT clean_old_metrics();');