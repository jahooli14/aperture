-- Allow list_item and todo as connection-suggestion endpoints.
--
-- Connection discovery builds candidates from projects, memories, articles AND
-- list_items, and the source item can be a todo. Candidates that score in the
-- suggestion band (below the auto-link threshold) are written to
-- connection_suggestions, but its from_item_type / to_item_type CHECK only
-- allowed ('project','thought','article'). So any list_item or todo suggestion
-- violated the CHECK and the INSERT failed silently — those cross-domain
-- suggestions (e.g. a saved film → a project) never persisted. The auto-link
-- path (connections table) has no such CHECK and already handles list_items, so
-- widen the suggestion constraint to match.

ALTER TABLE connection_suggestions
  DROP CONSTRAINT IF EXISTS connection_suggestions_from_item_type_check,
  DROP CONSTRAINT IF EXISTS connection_suggestions_to_item_type_check;

ALTER TABLE connection_suggestions
  ADD CONSTRAINT connection_suggestions_from_item_type_check
    CHECK (from_item_type IN ('project', 'thought', 'article', 'list_item', 'todo')),
  ADD CONSTRAINT connection_suggestions_to_item_type_check
    CHECK (to_item_type IN ('project', 'thought', 'article', 'list_item', 'todo'));
