-- ============================================================
-- 027_flow_ai_step.sql
-- No schema changes needed — AI step config is stored in the
-- existing JSONB config column on flow_steps/flow_nodes.
-- This migration only documents the expected config shape.
-- ============================================================

-- Expected config JSON for an AI Reply step:
-- {
--   "system_prompt": "You are a helpful customer support agent for Acme Co...",
--   "max_tokens": 300,
--   "temperature": 0.7,
--   "fallback_message": "I'm sorry, I couldn't process that. Please try again.",
--   "context_messages": 10   -- how many prior messages to include as context
-- }

-- No ALTER TABLE needed.
SELECT 1; -- no-op, migration is documentation only