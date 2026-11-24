-- ============================================================================
-- VCPL Tools: Homepage "What's New at VCPL" Announcements Migration
-- Safe to re-run (idempotent).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.homepage_announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  badge TEXT NOT NULL DEFAULT 'NEW',
  summary TEXT NOT NULL,
  launch_date TEXT NOT NULL,
  tool_id TEXT NOT NULL DEFAULT '',
  action_label TEXT NOT NULL DEFAULT 'Open Tool',
  action_url TEXT NOT NULL DEFAULT '',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homepage_announcements_active
  ON public.homepage_announcements (is_active, is_pinned DESC, sort_order ASC, launch_date DESC);

ALTER TABLE public.homepage_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vcpl_deny_anon ON public.homepage_announcements;
CREATE POLICY vcpl_deny_anon
  ON public.homepage_announcements
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

INSERT INTO public.homepage_announcements (
  id, title, badge, summary, launch_date, tool_id, action_label, action_url,
  is_pinned, is_active, sort_order, created_by, updated_by
)
VALUES (
  'ann_vcpl_ai_text_cleaner',
  'VCPL AI Text Cleaner',
  'NEW',
  'Strip ChatGPT/Claude/Gemini Markdown, citation tokens, invisible characters, stray symbols, and broken spacing 100% locally while preserving every word and original meaning.',
  '2026-11-24',
  'ai-text-cleaner',
  'Open Tool',
  '',
  TRUE,
  TRUE,
  1,
  'system',
  'system'
)
ON CONFLICT (id) DO NOTHING;
