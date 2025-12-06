-- Create RPC to get random items with embeddings across tables
-- This is needed for the Serendipity Engine to sample the vector space efficiently

CREATE OR REPLACE FUNCTION get_random_items_with_embeddings(user_id_param UUID, limit_param INT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  type TEXT,
  embedding VECTOR(768)
) AS $$
BEGIN
  RETURN QUERY
  (
    SELECT id, title, 'project' as type, embedding 
    FROM projects 
    WHERE user_id = user_id_param AND embedding IS NOT NULL 
    ORDER BY RANDOM() 
    LIMIT limit_param
  )
  UNION ALL
  (
    SELECT id, title, 'thought' as type, embedding 
    FROM memories 
    WHERE user_id = user_id_param AND embedding IS NOT NULL 
    ORDER BY RANDOM() 
    LIMIT limit_param
  )
  UNION ALL
  (
    SELECT id, title, 'article' as type, embedding 
    FROM reading_queue 
    WHERE user_id = user_id_param AND embedding IS NOT NULL 
    ORDER BY RANDOM() 
    LIMIT limit_param
  )
  ORDER BY RANDOM()
  LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;
