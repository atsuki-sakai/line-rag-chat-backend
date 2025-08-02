-- Add performance-critical indexes for line_messages table
-- This migration significantly improves query performance

-- Index for user conversation lookup (most frequent query)
CREATE INDEX IF NOT EXISTS idx_line_messages_user_created 
ON line_messages(user_id, created_at DESC);

-- Index for conversation_id lookups
CREATE INDEX IF NOT EXISTS idx_line_messages_conversation 
ON line_messages(conversation_id);

-- Composite index for efficient user message history queries
CREATE INDEX IF NOT EXISTS idx_line_messages_user_type_created 
ON line_messages(user_id, message_type, created_at DESC);