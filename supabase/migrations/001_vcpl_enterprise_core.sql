-- VCPL Tools Enterprise PostgreSQL Schema (Supabase)
-- Migration: 001_vcpl_enterprise_core.sql
-- Safe to run idempotently in Supabase SQL Editor or CI/CD migration pipeline.

-- 1. Departments & Designations
CREATE TABLE IF NOT EXISTS public.enterprise_departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.enterprise_designations (
  id TEXT PRIMARY KEY,
  department_id TEXT REFERENCES public.enterprise_departments(id) ON DELETE SET NULL,
  name TEXT NOT NULL UNIQUE,
  default_role TEXT NOT NULL DEFAULT 'employee' CHECK (default_role IN ('super_admin', 'employee')),
  default_permissions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enterprise Users & Server Sessions
CREATE TABLE IF NOT EXISTS public.enterprise_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_username TEXT NOT NULL,
  internal_auth_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  employee_id TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT 'Operations',
  designation TEXT NOT NULL DEFAULT 'Staff',
  contact_number TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('super_admin', 'employee')),
  status TEXT NOT NULL DEFAULT 'Pending Approval' CHECK (
    status IN (
      'Pending Approval',
      'Approved',
      'Active',
      'Suspended',
      'Inactive',
      'Password Reset Required',
      'Rejected'
    )
  ),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  token_version INTEGER NOT NULL DEFAULT 1,
  last_login_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL DEFAULT 'system',
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_enterprise_users_username_lower
  ON public.enterprise_users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_enterprise_users_role_status
  ON public.enterprise_users (role, status, is_archived);

CREATE TABLE IF NOT EXISTS public.enterprise_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.enterprise_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  token_version INTEGER NOT NULL DEFAULT 1,
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_sessions_user_active
  ON public.enterprise_sessions (user_id, revoked_at, expires_at);

-- 3. Tool & Module Permissions
CREATE TABLE IF NOT EXISTS public.enterprise_permissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.enterprise_users(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  permissions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_enterprise_permissions_user
  ON public.enterprise_permissions (user_id);

-- 4. Password Reset Queue & Audit Logs
CREATE TABLE IF NOT EXISTS public.enterprise_password_reset_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.enterprise_users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Completed')),
  note TEXT NOT NULL DEFAULT '',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_enterprise_resets_status
  ON public.enterprise_password_reset_requests (status, requested_at DESC);

CREATE TABLE IF NOT EXISTS public.enterprise_login_history (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_login_history_created
  ON public.enterprise_login_history (created_at DESC);

CREATE TABLE IF NOT EXISTS public.enterprise_activity_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL DEFAULT '',
  actor_username TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_activity_logs_created
  ON public.enterprise_activity_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.enterprise_audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL DEFAULT '',
  actor_username TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  event_type TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  before_json JSONB,
  after_json JSONB,
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_audit_logs_created
  ON public.enterprise_audit_logs (created_at DESC);

-- 5. Central Company Google Drive Structure & Document Metadata (No Binary Blobs in DB)
CREATE TABLE IF NOT EXISTS public.google_drive_configuration (
  id TEXT PRIMARY KEY,
  auth_mode TEXT NOT NULL DEFAULT 'unconfigured',
  root_folder_id TEXT NOT NULL DEFAULT '',
  root_folder_name TEXT NOT NULL DEFAULT 'VCPL TOOLS - COMPANY DRIVE',
  shared_drive_id TEXT NOT NULL DEFAULT '',
  service_account_email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Not Configured',
  last_verified_at TIMESTAMPTZ,
  last_error TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.google_drive_folders (
  id TEXT PRIMARY KEY,
  folder_key TEXT NOT NULL UNIQUE,
  folder_name TEXT NOT NULL,
  parent_key TEXT NOT NULL DEFAULT '',
  drive_folder_id TEXT NOT NULL DEFAULT '',
  drive_parent_id TEXT NOT NULL DEFAULT '',
  module_id TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.enterprise_documents (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  folder_key TEXT NOT NULL DEFAULT '04_DOCUMENT_VAULT',
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  approval_status TEXT NOT NULL DEFAULT 'Draft' CHECK (
    approval_status IN ('Draft', 'Pending Review', 'Approved', 'Rejected')
  ),
  storage_provider TEXT NOT NULL DEFAULT 'google_drive',
  drive_file_id TEXT NOT NULL DEFAULT '',
  drive_folder_id TEXT NOT NULL DEFAULT '',
  drive_web_view_link TEXT NOT NULL DEFAULT '',
  checksum_sha256 TEXT NOT NULL DEFAULT '',
  version_number INTEGER NOT NULL DEFAULT 1,
  tags TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  uploaded_by TEXT NOT NULL,
  uploaded_by_username TEXT NOT NULL,
  approved_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_documents_module
  ON public.enterprise_documents (module_id, approval_status, is_archived, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_enterprise_documents_uploader
  ON public.enterprise_documents (uploaded_by, created_at DESC);

CREATE TABLE IF NOT EXISTS public.enterprise_document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES public.enterprise_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  drive_file_id TEXT NOT NULL DEFAULT '',
  drive_web_view_link TEXT NOT NULL DEFAULT '',
  checksum_sha256 TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL,
  uploaded_by_username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_doc_versions_doc
  ON public.enterprise_document_versions (document_id, version_number DESC);

-- 6. Central Workspace Records, Generated Report Logs & App Settings
CREATE TABLE IF NOT EXISTS public.enterprise_workspace_records (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  record_title TEXT NOT NULL,
  reference_code TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_by_username TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_records_module
  ON public.enterprise_workspace_records (module_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.report_management_records (
  id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL,
  report_title TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'csv' CHECK (format IN ('csv', 'xlsx', 'json', 'pdf')),
  module_filter TEXT NOT NULL DEFAULT 'all',
  date_range_label TEXT NOT NULL DEFAULT 'All Time',
  row_count INTEGER NOT NULL DEFAULT 0,
  drive_file_id TEXT NOT NULL DEFAULT '',
  drive_web_view_link TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Generated',
  generated_by TEXT NOT NULL,
  generated_by_username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_management_created
  ON public.report_management_records (created_at DESC);

CREATE TABLE IF NOT EXISTS public.enterprise_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Daily Blog Scheduler & Shared App Settings (Persistent on Vercel Serverless)
CREATE TABLE IF NOT EXISTS public.auto_blog_posts (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  queue_no INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content_markdown TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  keywords_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  tool_id TEXT NOT NULL,
  tool_slug TEXT NOT NULL,
  hero_svg_url TEXT NOT NULL,
  seo_title TEXT NOT NULL,
  seo_description TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 900,
  reading_minutes INTEGER NOT NULL DEFAULT 5,
  published_date_ist TEXT NOT NULL UNIQUE,
  published_at_iso TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'gemini',
  indexnow_status TEXT NOT NULL DEFAULT 'pending',
  post_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  cover_svg TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_blog_posts_date
  ON public.auto_blog_posts (published_date_ist DESC);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Row Level Security (Deny public PostgREST access; server uses SUPABASE_SERVICE_ROLE_KEY)
ALTER TABLE public.enterprise_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_password_reset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_drive_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_drive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_workspace_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_management_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'enterprise_departments',
    'enterprise_designations',
    'enterprise_users',
    'enterprise_sessions',
    'enterprise_permissions',
    'enterprise_password_reset_requests',
    'enterprise_login_history',
    'enterprise_activity_logs',
    'enterprise_audit_logs',
    'google_drive_configuration',
    'google_drive_folders',
    'enterprise_documents',
    'enterprise_document_versions',
    'enterprise_workspace_records',
    'report_management_records',
    'enterprise_settings',
    'auto_blog_posts',
    'app_settings'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS vcpl_deny_anon ON public.%I;', tbl);
    EXECUTE format('CREATE POLICY vcpl_deny_anon ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);', tbl);
  END LOOP;
END $$;

-- 9. Default Department & Designation Seeds
INSERT INTO public.enterprise_departments (id, name, code, description)
VALUES
  ('dept_accounts', 'Accounts & Finance', 'ACC', 'Ledger, invoicing, bank slips, payments and reconciliation'),
  ('dept_tax_gst', 'Taxation & GST', 'TAX', 'Form 26AS, GSTR-1, GSTR-2B, TDS/TCS and statutory returns'),
  ('dept_dealership', 'Dealership Operations', 'OPS', 'DMS vs Tally, BMW/Bajaj claims, incentives and billing'),
  ('dept_compliance', 'Audit & Compliance', 'AUD', 'Statutory retention, compliance calendar and document verification'),
  ('dept_admin', 'Administration', 'ADM', 'Executive governance, approvals, system backups and user control')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.enterprise_designations (id, department_id, name, default_role, default_permissions_json)
VALUES
  ('desig_accounts_exec', 'dept_accounts', 'Accounts Executive', 'employee', '{"accounts-workspace":{"view":true,"create":true,"edit":true,"upload":true,"download":true},"auto-ledger":{"view":true,"create":true,"edit":true,"upload":true,"download":true,"export":true},"document-vault":{"view":true,"upload":true,"download":true}}'::jsonb),
  ('desig_senior_accountant', 'dept_accounts', 'Senior Accountant', 'employee', '{"accounts-workspace":{"view":true,"create":true,"edit":true,"upload":true,"download":true,"approve":true,"export":true},"auto-ledger":{"view":true,"create":true,"edit":true,"upload":true,"download":true,"approve":true,"export":true},"document-vault":{"view":true,"create":true,"edit":true,"upload":true,"download":true,"approve":true,"export":true}}'::jsonb),
  ('desig_tax_analyst', 'dept_tax_gst', 'Tax & GST Analyst', 'employee', '{"compliance-tracker":{"view":true,"create":true,"edit":true,"upload":true,"download":true,"export":true},"gstr2b-reconciler":{"view":true,"create":true,"edit":true,"upload":true,"download":true,"export":true},"form26as-to-excel":{"view":true,"create":true,"edit":true,"upload":true,"download":true,"export":true},"gstr1-return-prep":{"view":true,"create":true,"edit":true,"upload":true,"download":true,"export":true}}'::jsonb),
  ('desig_branch_auditor', 'dept_compliance', 'Auditor / Reviewer', 'employee', '{"document-vault":{"view":true,"download":true,"approve":true,"export":true},"compliance-tracker":{"view":true,"download":true,"approve":true,"export":true},"admin-register":{"view":true,"download":true}}'::jsonb),
  ('desig_dealership_mgr', 'dept_dealership', 'Dealership Operations Manager', 'employee', '{"dealership-ops":{"view":true,"create":true,"edit":true,"upload":true,"download":true,"approve":true,"export":true},"document-vault":{"view":true,"create":true,"upload":true,"download":true,"export":true}}'::jsonb),
  ('desig_super_admin', 'dept_admin', 'Super Admin / Director', 'super_admin', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
