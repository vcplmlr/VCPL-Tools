import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedSupabaseClient: SupabaseClient | null | undefined;

export function getSupabaseConfig(): {
  url: string;
  serviceRoleKey: string;
  configured: boolean;
} {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return {
    url,
    serviceRoleKey,
    configured: Boolean(url && serviceRoleKey),
  };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().configured;
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (cachedSupabaseClient !== undefined) {
    return cachedSupabaseClient;
  }
  const { url, serviceRoleKey, configured } = getSupabaseConfig();
  if (!configured) {
    cachedSupabaseClient = null;
    return null;
  }

  cachedSupabaseClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'x-vcpl-runtime': 'server-admin',
      },
    },
  });
  return cachedSupabaseClient;
}

export function isRunningOnVercel(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

export type PersistenceMode = 'supabase' | 'sqlite_local' | 'sqlite_ephemeral_warning';

export function getPersistenceMode(): PersistenceMode {
  if (isSupabaseConfigured()) {
    return 'supabase';
  }
  if (isRunningOnVercel()) {
    return 'sqlite_ephemeral_warning';
  }
  return 'sqlite_local';
}

export async function checkSupabaseHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  mode: PersistenceMode;
  error?: string;
  schemaReady?: boolean;
}> {
  const mode = getPersistenceMode();
  const client = getSupabaseAdminClient();
  if (!client) {
    return {
      configured: false,
      connected: false,
      mode,
      schemaReady: false,
      error: isRunningOnVercel()
        ? 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are missing in Vercel Environment Variables. Ephemeral local storage cannot persist multi-user production data.'
        : 'Supabase environment variables are not set; running in local SQLite development fallback.',
    };
  }

  try {
    const { error } = await client
      .from('enterprise_users')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      return {
        configured: true,
        connected: false,
        mode,
        schemaReady: false,
        error: `Supabase query failed: ${error.message}. Run /supabase/migrations/001_vcpl_enterprise_core.sql in Supabase SQL Editor.`,
      };
    }

    return {
      configured: true,
      connected: true,
      mode: 'supabase',
      schemaReady: true,
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      mode,
      schemaReady: false,
      error: err instanceof Error ? err.message : 'Unable to reach Supabase PostgreSQL.',
    };
  }
}
