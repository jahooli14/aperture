-- Migration: Trigger AI Processing on Memory Creation
-- Description: Uses pg_net to call Vercel API webhook whenever a new memory is inserted
-- Created: 2025-11-24

-- 1. Enable the pg_net extension (allows HTTP calls from Postgres)
create extension if not exists pg_net;

-- 2. Create the trigger function
create or replace function public.trigger_memory_ai_processing()
returns trigger as $$
declare
  -- REPLACEME: Update this URL to your deployed Vercel project URL
  -- Example: 'https://your-project.vercel.app/api/memories?action=process'
  project_url text := 'https://clandestined.vercel.app/api/memories?action=process';
  
  -- Secret token for security (Optional: add checking in your API if desired)
  api_secret text := 'your-shared-secret';
  
  request_id int;
begin
  -- Only trigger for memories that haven't been processed yet
  if (new.processed = false) then
    
    -- Make async HTTP POST request to the Vercel API
    select net.http_post(
        url := project_url,
        body := jsonb_build_object(
            'memory_id', new.id,
            'secret', api_secret
        ),
        headers := '{"Content-Type": "application/json"}'::jsonb
    ) into request_id;
    
  end if;
  
  return new;
end;
$$ language plpgsql;

-- 3. Create the trigger on the memories table
drop trigger if exists on_memory_created_process_ai on public.memories;

create trigger on_memory_created_process_ai
  after insert on public.memories
  for each row
  execute function public.trigger_memory_ai_processing();

-- Documentation
comment on function public.trigger_memory_ai_processing is 'Triggers Vercel Edge Function to process memory embeddings and tags via HTTP webhook';
