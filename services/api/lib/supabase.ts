import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import WebSocket from 'ws';

export function createSupabaseClient(
  supabaseUrl: string,
  supabaseKey: string,
  options: SupabaseClientOptions<'public'> = {}
) {
  return createClient(supabaseUrl, supabaseKey, {
    ...options,
    realtime: {
      ...options.realtime,
      transport: WebSocket as any,
    },
  });
}
