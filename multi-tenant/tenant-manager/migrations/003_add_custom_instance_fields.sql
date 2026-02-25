-- Add support for custom and hardware instances
-- Add columns for tracking external instances

-- Add source column to track instance type
ALTER TABLE instances ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'managed';

-- Add custom instance columns
ALTER TABLE instances ADD COLUMN IF NOT EXISTS custom_url TEXT;
ALTER TABLE instances ADD COLUMN IF NOT EXISTS health_check_url TEXT;
ALTER TABLE instances ADD COLUMN IF NOT EXISTS health_check_interval INTEGER DEFAULT 60;
ALTER TABLE instances ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMP;
ALTER TABLE instances ADD COLUMN IF NOT EXISTS is_healthy BOOLEAN;

-- Add index on source for faster queries
CREATE INDEX IF NOT EXISTS idx_instances_source ON instances(source);

-- Add comments for documentation
COMMENT ON COLUMN instances.source IS 'Instance source: managed (created by us), custom (cloud), or hardware (local device)';
COMMENT ON instances.custom_url IS 'Custom URL for external instances (custom or hardware)';
COMMENT ON instances.health_check_url IS 'Custom health check endpoint for external instances';
COMMENT ON instances.health_check_interval IS 'Health check interval in seconds';
COMMENT ON instances.last_health_check IS 'Timestamp of last health check';
COMMENT ON instances.is_healthy IS 'Health status from last health check (NULL for managed instances)';
