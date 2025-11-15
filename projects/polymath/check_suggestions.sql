SELECT 
  cs.id,
  cs.from_item_id,
  cs.from_item_type,
  cs.to_item_id,
  cs.to_item_type,
  cs.confidence,
  cs.status,
  cs.created_at,
  m.title as from_title
FROM connection_suggestions cs
LEFT JOIN memories m ON cs.from_item_id = m.id
WHERE cs.status = 'pending'
ORDER BY cs.created_at DESC
LIMIT 10;
