-- ReturnFeed Database Schema - Email-Only Authentication
-- Clean implementation without username field

-- Drop existing tables if they exist (careful in production!)
DROP TABLE IF EXISTS stream_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table with email as primary identifier
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    
    -- Display and URL fields
    display_name VARCHAR(100),  -- Optional display name
    profile_slug VARCHAR(100) UNIQUE NOT NULL,  -- URL-safe identifier
    
    -- Streaming fields
    stream_key VARCHAR(40) UNIQUE NOT NULL,
    
    -- PD specific fields
    role VARCHAR(50) DEFAULT 'user',
    is_pd BOOLEAN DEFAULT false,
    pd_software_version VARCHAR(50),
    last_pd_login TIMESTAMP,
    
    -- Metadata
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

-- Create stream sessions table
CREATE TABLE stream_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_key VARCHAR(32) UNIQUE NOT NULL,
    
    -- Stream configuration
    rtmp_url VARCHAR(500),
    srt_url VARCHAR(500),
    staff_url VARCHAR(500),
    viewer_count INTEGER DEFAULT 0,
    
    -- Session management
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    
    -- Tally state
    tally_pgm BOOLEAN DEFAULT false,
    tally_pvw BOOLEAN DEFAULT false,
    last_tally_update TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(LOWER(email));
CREATE INDEX idx_users_profile_slug ON users(profile_slug);
CREATE INDEX idx_users_stream_key ON users(stream_key);
CREATE INDEX idx_users_is_pd ON users(is_pd) WHERE is_pd = true;
CREATE INDEX idx_stream_sessions_user_id ON stream_sessions(user_id);
CREATE INDEX idx_stream_sessions_session_key ON stream_sessions(session_key);
CREATE INDEX idx_stream_sessions_active ON stream_sessions(is_active) WHERE is_active = true;

-- Function to generate unique profile slug
CREATE OR REPLACE FUNCTION generate_profile_slug(base_slug TEXT)
RETURNS TEXT AS $$
DECLARE
    slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Clean the base slug
    slug := LOWER(REGEXP_REPLACE(base_slug, '[^a-z0-9]+', '-', 'g'));
    slug := TRIM(BOTH '-' FROM slug);
    
    -- Check if slug exists
    WHILE EXISTS (SELECT 1 FROM users WHERE profile_slug = slug) LOOP
        counter := counter + 1;
        slug := LOWER(REGEXP_REPLACE(base_slug, '[^a-z0-9]+', '-', 'g')) || '-' || counter;
    END LOOP;
    
    RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- Function to generate stream key
CREATE OR REPLACE FUNCTION generate_stream_key()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(20), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at();

-- View for active streams
CREATE OR REPLACE VIEW active_streams AS
SELECT 
    u.id as user_id,
    u.email,
    u.display_name,
    u.profile_slug,
    s.session_key,
    s.rtmp_url,
    s.srt_url,
    s.staff_url,
    s.viewer_count,
    s.tally_pgm,
    s.tally_pvw,
    s.created_at as stream_started
FROM users u
JOIN stream_sessions s ON u.id = s.user_id
WHERE s.is_active = true;

-- Sample data for testing (remove in production)
-- Password is 'test123' hashed with bcrypt
INSERT INTO users (email, password_hash, display_name, profile_slug, stream_key, role, is_pd) VALUES
('admin@returnfeed.net', '$2a$10$rBYLkCxrHDFYHmfkXWYJZOqVqcGXoP5HYqyNxTDqFGqOXBhOHvO5i', 'Admin', 'admin', generate_stream_key(), 'admin', false),
('pd1@example.com', '$2a$10$rBYLkCxrHDFYHmfkXWYJZOqVqcGXoP5HYqyNxTDqFGqOXBhOHvO5i', 'PD Seoul', 'pd-seoul', generate_stream_key(), 'pd', true),
('pd2@example.com', '$2a$10$rBYLkCxrHDFYHmfkXWYJZOqVqcGXoP5HYqyNxTDqFGqOXBhOHvO5i', 'PD Tokyo', 'pd-tokyo', generate_stream_key(), 'pd', true);

-- Grant permissions (adjust for your setup)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
-- GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;