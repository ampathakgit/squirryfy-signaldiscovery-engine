import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: any = null;

function getSupabase() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Supabase] WARNING: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
    }

    supabaseInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
      }
    });
  }
  return supabaseInstance;
}

// Wrap the client in a Proxy to defer actual instantiation until first property access
const supabase = new Proxy({} as any, {
  get(target, prop, receiver) {
    const instance = getSupabase();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  }
}) as SupabaseClient;

export default supabase;
export type SupabaseClientType = typeof supabase;



