-- ============================================================
-- 024_agent_performance_view.sql
-- Read-only view for agent performance metrics.
-- No table modifications — view only.
-- ============================================================

CREATE OR REPLACE VIEW agent_performance AS
SELECT
  au.id                                         AS agent_id,
  au.email                                      AS agent_email,
  COALESCE(p.full_name, au.email)               AS agent_name,

  -- Conversations assigned to this agent in the last 30 days
  COUNT(DISTINCT c.id)                          AS conversations_handled,

  -- Resolved conversations (using 'closed' status based on ConversationStatus type)
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'closed')  AS resolved_count,

  -- Average first response time in seconds
  -- (time between inbound message and first outbound reply)
  AVG(
    EXTRACT(EPOCH FROM (
      (SELECT MIN(m2.created_at) FROM messages m2
       WHERE m2.conversation_id = c.id AND m2.sender_type IN ('agent', 'bot'))
      -
      (SELECT MIN(m3.created_at) FROM messages m3
       WHERE m3.conversation_id = c.id AND m3.sender_type = 'customer')
    ))
  ) FILTER (WHERE c.assigned_agent_id = au.id)  AS avg_first_response_seconds,

  -- Average conversation duration in seconds
  AVG(
    EXTRACT(EPOCH FROM (c.updated_at - c.created_at))
  ) FILTER (WHERE c.status = 'closed')          AS avg_resolution_seconds

FROM auth.users au
JOIN profiles p ON p.user_id = au.id
LEFT JOIN conversations c
  ON c.assigned_agent_id = au.id
  AND c.created_at >= NOW() - INTERVAL '30 days'
GROUP BY au.id, au.email, p.full_name;
