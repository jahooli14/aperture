-- Server errors, kept. Vercel Hobby only keeps runtime logs for an hour.
CREATE TABLE IF NOT EXISTS public.app_errors (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  route text NOT NULL,
  resource text,
  method text,
  status int,
  message text
);
CREATE INDEX IF NOT EXISTS app_errors_at_idx ON public.app_errors (at DESC);
-- Server-only: RLS on, no policy (the API uses the service role).
ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;
