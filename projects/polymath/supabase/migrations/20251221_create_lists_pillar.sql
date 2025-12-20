-- Create List Types Enum
CREATE TYPE list_type AS ENUM (
  'film', 
  'music', 
  'tech', 
  'book', 
  'place', 
  'game', 
  'software', 
  'event', 
  'generic'
);

-- Create List Item Status Enum
CREATE TYPE list_item_status AS ENUM (
  'pending', 
  'active', 
  'completed', 
  'abandoned'
);

-- Create Lists Table
CREATE TABLE IF NOT EXISTS public.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type list_type NOT NULL DEFAULT 'generic',
  description TEXT,
  icon TEXT, -- Lucide icon name
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create List Items Table
CREATE TABLE IF NOT EXISTS public.list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status list_item_status NOT NULL DEFAULT 'pending',
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  metadata JSONB DEFAULT '{}'::JSONB,
  enrichment_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Lists
CREATE POLICY "Users can view their own lists" 
  ON public.lists FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lists" 
  ON public.lists FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lists" 
  ON public.lists FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lists" 
  ON public.lists FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for List Items
CREATE POLICY "Users can view their own list items" 
  ON public.list_items FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own list items" 
  ON public.list_items FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own list items" 
  ON public.list_items FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own list items" 
  ON public.list_items FOR DELETE 
  USING (auth.uid() = user_id);

-- Indexes for Performance
CREATE INDEX idx_lists_user_id ON public.lists(user_id);
CREATE INDEX idx_list_items_list_id ON public.list_items(list_id);
CREATE INDEX idx_list_items_user_id ON public.list_items(user_id); -- For fetching all user items if needed
CREATE INDEX idx_list_items_status ON public.list_items(status);

-- Updated_at Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lists_updated_at
    BEFORE UPDATE ON public.lists
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_list_items_updated_at
    BEFORE UPDATE ON public.list_items
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
