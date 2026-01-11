-- Analogue: Manuscript IDE Schema
-- Initial migration for manuscript editing application

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Manuscripts table
CREATE TABLE manuscripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    protagonist_real_name TEXT DEFAULT '',
    mask_mode_enabled BOOLEAN DEFAULT FALSE,
    current_section TEXT DEFAULT 'departure' CHECK (current_section IN ('departure', 'escape', 'rupture', 'alignment', 'reveal')),
    total_word_count INTEGER DEFAULT 0,
    reveal_audit_unlocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scene nodes table
CREATE TABLE scene_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    title TEXT NOT NULL,
    section TEXT DEFAULT 'departure' CHECK (section IN ('departure', 'escape', 'rupture', 'alignment', 'reveal')),
    prose TEXT DEFAULT '',
    footnotes TEXT DEFAULT '',
    word_count INTEGER DEFAULT 0,
    identity_type TEXT CHECK (identity_type IN ('alex', 'villager-issue') OR identity_type IS NULL),
    sensory_focus TEXT CHECK (sensory_focus IN ('sight', 'smell', 'sound', 'taste', 'touch') OR sensory_focus IS NULL),
    awareness_level TEXT CHECK (awareness_level IN ('high-drift', 'moderate-drift', 'emerging', 'cohesive', 'fully-present') OR awareness_level IS NULL),
    footnote_tone TEXT CHECK (footnote_tone IN ('high-acerbic', 'moderate', 'gentle', 'absent') OR footnote_tone IS NULL),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in-progress', 'needs-review', 'complete')),
    validation_status TEXT DEFAULT 'yellow' CHECK (validation_status IN ('green', 'yellow', 'red')),
    checklist JSONB DEFAULT '[]'::JSONB,
    senses_activated TEXT[] DEFAULT '{}',
    pulse_check_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reverberations table (Core Wisdom)
CREATE TABLE reverberations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    scene_id UUID NOT NULL REFERENCES scene_nodes(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    speaker TEXT NOT NULL CHECK (speaker IN ('al', 'lexi', 'villager')),
    villager_name TEXT,
    linked_reveal_scene_id UUID REFERENCES scene_nodes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Glasses mentions table (Placebo Monitor)
CREATE TABLE glasses_mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    scene_id UUID NOT NULL REFERENCES scene_nodes(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_valid_draw BOOLEAN DEFAULT FALSE,
    flagged BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Speech patterns table (Identity Tracking)
CREATE TABLE speech_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    phrase TEXT NOT NULL,
    character_source TEXT NOT NULL CHECK (character_source IN ('al', 'lexi')),
    occurrences JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_scene_nodes_manuscript ON scene_nodes(manuscript_id);
CREATE INDEX idx_scene_nodes_section ON scene_nodes(section);
CREATE INDEX idx_scene_nodes_order ON scene_nodes(manuscript_id, order_index);
CREATE INDEX idx_reverberations_manuscript ON reverberations(manuscript_id);
CREATE INDEX idx_reverberations_scene ON reverberations(scene_id);
CREATE INDEX idx_glasses_mentions_scene ON glasses_mentions(scene_id);
CREATE INDEX idx_speech_patterns_manuscript ON speech_patterns(manuscript_id);

-- Row Level Security
ALTER TABLE manuscripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reverberations ENABLE ROW LEVEL SECURITY;
ALTER TABLE glasses_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE speech_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own manuscripts" ON manuscripts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own manuscripts" ON manuscripts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own manuscripts" ON manuscripts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own manuscripts" ON manuscripts
    FOR DELETE USING (auth.uid() = user_id);

-- Scene nodes policies
CREATE POLICY "Users can view own scenes" ON scene_nodes
    FOR SELECT USING (
        manuscript_id IN (SELECT id FROM manuscripts WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can insert own scenes" ON scene_nodes
    FOR INSERT WITH CHECK (
        manuscript_id IN (SELECT id FROM manuscripts WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update own scenes" ON scene_nodes
    FOR UPDATE USING (
        manuscript_id IN (SELECT id FROM manuscripts WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can delete own scenes" ON scene_nodes
    FOR DELETE USING (
        manuscript_id IN (SELECT id FROM manuscripts WHERE user_id = auth.uid())
    );

-- Reverberations policies
CREATE POLICY "Users can manage own reverberations" ON reverberations
    FOR ALL USING (
        manuscript_id IN (SELECT id FROM manuscripts WHERE user_id = auth.uid())
    );

-- Glasses mentions policies
CREATE POLICY "Users can manage own glasses mentions" ON glasses_mentions
    FOR ALL USING (
        manuscript_id IN (SELECT id FROM manuscripts WHERE user_id = auth.uid())
    );

-- Speech patterns policies
CREATE POLICY "Users can manage own speech patterns" ON speech_patterns
    FOR ALL USING (
        manuscript_id IN (SELECT id FROM manuscripts WHERE user_id = auth.uid())
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_manuscripts_updated_at
    BEFORE UPDATE ON manuscripts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scene_nodes_updated_at
    BEFORE UPDATE ON scene_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
