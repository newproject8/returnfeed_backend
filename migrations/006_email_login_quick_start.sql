-- ReturnFeed Email Login Migration
-- Quick Start Implementation

-- Step 1: Add new columns (safe - doesn't break existing)
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stream_slug VARCHAR(100) UNIQUE;

-- Step 2: Populate new fields from existing username
UPDATE users 
SET 
    display_name = COALESCE(display_name, username),
    stream_slug = COALESCE(stream_slug, LOWER(REGEXP_REPLACE(username, '[^a-zA-Z0-9]+', '-', 'g')))
WHERE username IS NOT NULL;

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_stream_slug ON users(stream_slug);

-- Step 4: Add email login tracking (optional)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_email_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_method VARCHAR(20) DEFAULT 'username';

-- View to check migration status
CREATE OR REPLACE VIEW email_migration_status AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as users_with_email,
    COUNT(CASE WHEN display_name IS NOT NULL THEN 1 END) as users_with_display_name,
    COUNT(CASE WHEN stream_slug IS NOT NULL THEN 1 END) as users_with_stream_slug,
    COUNT(CASE WHEN login_method = 'email' THEN 1 END) as email_login_users
FROM users;

-- Check for potential issues
CREATE OR REPLACE VIEW email_migration_issues AS
-- Duplicate emails
SELECT 'duplicate_email' as issue_type, email, COUNT(*) as count
FROM users
WHERE email IS NOT NULL AND email != ''
GROUP BY email
HAVING COUNT(*) > 1

UNION ALL

-- Missing emails
SELECT 'missing_email' as issue_type, username as email, 1 as count
FROM users
WHERE email IS NULL OR email = ''

UNION ALL

-- Invalid emails
SELECT 'invalid_email' as issue_type, email, 1 as count
FROM users
WHERE email IS NOT NULL 
AND email != ''
AND email NOT LIKE '%@%.%';

-- Safe rollback if needed
-- ALTER TABLE users DROP COLUMN IF EXISTS display_name;
-- ALTER TABLE users DROP COLUMN IF EXISTS stream_slug;
-- ALTER TABLE users DROP COLUMN IF EXISTS last_email_login;
-- ALTER TABLE users DROP COLUMN IF EXISTS login_method;
-- DROP INDEX IF EXISTS idx_users_email_lower;
-- DROP INDEX IF EXISTS idx_users_stream_slug;
-- DROP VIEW IF EXISTS email_migration_status;
-- DROP VIEW IF EXISTS email_migration_issues;