-- Seed Memory Prompts
-- Populates memory_prompts table with 40 template prompts
-- 10 required (priority 1-10) + 30 optional

-- ============================================================================
-- REQUIRED PROMPTS (1-10)
-- ============================================================================

-- Core Identity (3)
INSERT INTO memory_prompts (prompt_text, prompt_description, category, priority_order, is_required) VALUES
  (
    'Life Overview',
    'Give 3+ key phases or moments that shaped who you are today',
    'core_identity',
    1,
    true
  ),
  (
    'Current Situation',
    '3+ bullets about your life right now (where you live, what you do, who you''re with, daily rhythm)',
    'core_identity',
    2,
    true
  ),
  (
    'Values & Strengths',
    '3+ principles that guide you OR skills you''re known for',
    'core_identity',
    3,
    true
  );

-- Relationships (3)
INSERT INTO memory_prompts (prompt_text, prompt_description, category, priority_order, is_required) VALUES
  (
    'Partner/Close Relationship',
    '3+ things about your most important relationship',
    'relationships',
    4,
    true
  ),
  (
    'Family Core',
    '3+ facts about your immediate family (parents, siblings, kids)',
    'relationships',
    5,
    true
  ),
  (
    'Close Friends',
    '3+ people you''re closest to and why they matter',
    'relationships',
    6,
    true
  );

-- Work & Learning (2)
INSERT INTO memory_prompts (prompt_text, prompt_description, category, priority_order, is_required) VALUES
  (
    'Career Journey',
    '3+ pivotal moments or transitions in your work life',
    'education_career',
    7,
    true
  ),
  (
    'Current Work',
    '3+ things about what you do now and how it makes you feel',
    'education_career',
    8,
    true
  );

-- Interests & Future (2)
INSERT INTO memory_prompts (prompt_text, prompt_description, category, priority_order, is_required) VALUES
  (
    'Hobbies & Passions',
    '3+ things you do for fun or creative expression',
    'interests_hobbies',
    9,
    true
  ),
  (
    'Goals & Aspirations',
    '3+ things you''re working toward (short or long term)',
    'aspirations',
    10,
    true
  );

-- ============================================================================
-- OPTIONAL PROMPTS - Core Identity (2 more)
-- ============================================================================

INSERT INTO memory_prompts (prompt_text, prompt_description, category, priority_order, is_required) VALUES
  (
    'Challenges & Growth Areas',
    'What are you working on improving? What challenges do you face? Where do you want to grow?',
    'core_identity',
    NULL,
    false
  ),
  (
    'Personality Traits',
    'How would your closest friends describe you? What are your defining characteristics?',
    'core_identity',
    NULL,
    false
  );

-- ============================================================================
-- OPTIONAL PROMPTS - Relationships (5 more)
-- ============================================================================

INSERT INTO memory_prompts (prompt_text, prompt_description, category, priority_order, is_required) VALUES
  (
    'How You Met Your Partner',
    'Tell me the story of how you met your partner - the moment, context, first impressions, how it developed',
    'relationships',
    NULL,
    false
  ),
  (
    'Wedding Day',
    'Describe your wedding - date, location, who was there, memorable moments, how it felt',
    'relationships',
    NULL,
    false
  ),
  (
    'Parents',
    'Tell me about your parents - their names, personalities, relationship with them, what you learned from each',
    'relationships',
    NULL,
    false
  ),
  (
    'Siblings',
    'Do you have siblings? Names, ages, personalities, your relationship with each',
    'relationships',
    NULL,
    false
  ),
  (
    'Children',
    'Tell me about your kids - names, ages, personalities, what stage they''re in, your hopes for them',
    'relationships',
    NULL,
    false
  ),
  (
    'Groomsmen/Bridesmaids',
    'Tell me about each person in your wedding party - who they are, why you chose them, your history together',
    'relationships',
    NULL,
    false
  );

-- ============================================================================
-- OPTIONAL PROMPTS - Places & Geography (3)
-- ============================================================================

INSERT INTO memory_prompts (prompt_text, prompt_description, category, priority_order, is_required) VALUES
  (
    'Childhood Home',
    'Where did you grow up? Describe the place(s) - the house, neighborhood, what you remember most',
    'places',
    NULL,
    false
  ),
  (
    'Significant Places Lived',
    'List every place you''ve lived (city, duration, what you were doing there, key memories)',
    'places',
    NULL,
    false
  ),
  (
    'Meaningful Locations',
    'Are there places that hold special meaning? Travel destinations, childhood spots, places you return to?',
    'places',
    NULL,
    false
  );

-- ============================================================================
-- OPTIONAL PROMPTS - Education & Career (2 more)
-- ============================================================================

INSERT INTO memory_prompts (prompt_text, prompt_description, category, priority_order, is_required) VALUES
  (
    'School Years',
    'Tell me about your school experience - elementary through high school. Key memories, friends, subjects you loved/hated',
    'education_career',
    NULL,
    false
  ),
  (
    'University/College',
    'If you went to university - where, what you studied, why you chose it, favorite classes, campus life',
    'education_career',
    NULL,
    false
  );

-- ============================================================================
-- OPTIONAL PROMPTS - Interests & Hobbies (3 more)
-- ============================================================================

INSERT INTO memory_prompts (prompt_text, prompt_description, category, priority_order, is_required) VALUES
  (
    'Creative Pursuits',
    'Do you create anything? Art, music, writing, building, crafting? Describe what you make and why',
    'interests_hobbies',
    NULL,
    false
  ),
  (
    'Physical Activities',
    'What physical activities do you do? Sports, exercise, outdoor activities? How do they make you feel?',
    'interests_hobbies',
    NULL,
    false
  ),
  (
    'Media Consumption',
    'What do you watch, read, listen to? Favorite books, shows, podcasts, music genres? What draws you to them?',
    'interests_hobbies',
    NULL,
    false
  ),
  (
    'Learning & Curiosity',
    'What topics are you exploring right now? What questions keep you up at night? What do you want to learn?',
    'interests_hobbies',
    NULL,
    false
  );

-- ============================================================================
-- OPTIONAL PROMPTS - Life Events & Milestones (6)
-- ============================================================================

INSERT INTO memory_prompts (prompt_text, prompt_description, category, priority_order, is_required) VALUES
  (
    'Major Achievements',
    'What are you most proud of? Academic, career, personal, creative - anything that felt like a big win',
    'life_events',
    NULL,
    false
  ),
  (
    'Difficult Periods',
    'What hard times have you been through? What did you learn? How did they shape you?',
    'life_events',
    NULL,
    false
  ),
  (
    'Turning Points',
    'What moments changed the direction of your life? Decisions, events, realizations that altered your path',
    'life_events',
    NULL,
    false
  ),
  (
    'Travel & Adventures',
    'Where have you traveled? What trips stand out? What did you learn from being in different places?',
    'life_events',
    NULL,
    false
  ),
  (
    'Health & Wellness Journey',
    'Tell me about your health history - major illnesses, injuries, fitness phases, how you take care of yourself',
    'life_events',
    NULL,
    false
  ),
  (
    'Spiritual/Philosophical Journey',
    'How has your worldview evolved? Any spiritual practices, philosophical realizations, perspective shifts?',
    'life_events',
    NULL,
    false
  );

-- ============================================================================
-- OPTIONAL PROMPTS - Daily Life & Routines (4)
-- ============================================================================

INSERT INTO memory_prompts (prompt_text, prompt_description, category, priority_order, is_required) VALUES
  (
    'Morning Routine',
    'What''s your typical morning like? Walk me through from waking up to starting your day',
    'daily_life',
    NULL,
    false
  ),
  (
    'Evening Routine',
    'How do you wind down? Evening activities, dinner habits, how you transition to rest',
    'daily_life',
    NULL,
    false
  ),
  (
    'Weekend Patterns',
    'What do weekends look like? How do you spend free time? What''s your ideal weekend?',
    'daily_life',
    NULL,
    false
  ),
  (
    'Home Environment',
    'Describe your living space - the vibe, how it''s organized, your favorite spots, what makes it feel like home',
    'daily_life',
    NULL,
    false
  );

-- ============================================================================
-- OPTIONAL PROMPTS - Aspirations & Future (2 more)
-- ============================================================================

INSERT INTO memory_prompts (prompt_text, prompt_description, category, priority_order, is_required) VALUES
  (
    'Short-Term Goals (1-2 years)',
    'What are you working toward in the near future? Projects, skills, life changes, experiences you want',
    'aspirations',
    NULL,
    false
  ),
  (
    'Long-Term Vision (5-10 years)',
    'Where do you see yourself in the long term? Career, family, location, lifestyle, what you hope to build',
    'aspirations',
    NULL,
    false
  ),
  (
    'Legacy & Impact',
    'What do you want to be remembered for? What impact do you hope to have? What matters most to you?',
    'aspirations',
    NULL,
    false
  );

-- ============================================================================
-- OPTIONAL PROMPTS - Creative & Professional (2)
-- ============================================================================

INSERT INTO memory_prompts (prompt_text, prompt_description, category, priority_order, is_required) VALUES
  (
    'Projects You''ve Built',
    'List significant things you''ve created - code projects, creative works, businesses, initiatives. What and why?',
    'creative_professional',
    NULL,
    false
  ),
  (
    'Technical Capabilities',
    'What technical skills do you have? Programming languages, tools, frameworks, creative software, domains you know well',
    'creative_professional',
    NULL,
    false
  );

-- ============================================================================
-- VALIDATION
-- ============================================================================

-- Verify prompt counts
-- SELECT
--   category,
--   COUNT(*) as total,
--   COUNT(*) FILTER (WHERE is_required = true) as required,
--   COUNT(*) FILTER (WHERE is_required = false) as optional
-- FROM memory_prompts
-- GROUP BY category
-- ORDER BY category;

-- Expected:
-- - Total: 40 prompts
-- - Required: 10 prompts (priority 1-10)
-- - Optional: 30 prompts

-- Verify required prompts
-- SELECT priority_order, prompt_text, category
-- FROM memory_prompts
-- WHERE is_required = true
-- ORDER BY priority_order;

-- ============================================================================
-- SEED COMPLETE
-- ============================================================================

-- Next: Initialize user_prompt_status for each user
-- Run this for each existing user:
--
-- INSERT INTO user_prompt_status (user_id, prompt_id, status)
-- SELECT 'user-uuid-here', id, 'pending'
-- FROM memory_prompts
-- WHERE is_required = true
-- ON CONFLICT (user_id, prompt_id) DO NOTHING;
