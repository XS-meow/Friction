import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "[Friction] Supabase credentials not found. " +
        "Copy .env.local.example to .env.local and fill in your keys."
    );
    return null;
  }
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

export { getSupabase as supabaseClient };

// ── Session helpers ─────────────────────────────────────────

export interface Session {
  id?: string;
  status: "active" | "completed" | "cancelled";
  start_time: string;
  duration_minutes: number;
  end_time?: string | null;
  created_at?: string;
}

/**
 * Create a new focus session in Supabase.
 */
export async function createSession(
  durationMinutes: number
): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      status: "active",
      start_time: new Date().toISOString(),
      duration_minutes: durationMinutes,
    })
    .select()
    .single();

  if (error) {
    console.error("[Friction] Failed to create session:", error);
    return null;
  }

  return data as Session;
}

/**
 * Mark a session as completed.
 */
export async function completeSession(
  sessionId: string
): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("sessions")
    .update({
      status: "completed",
      end_time: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select()
    .single();

  if (error) {
    console.error("[Friction] Failed to complete session:", error);
    return null;
  }

  return data as Session;
}

/**
 * Get the most recent active session (if any).
 */
export async function getActiveSession(): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("sessions")
    .select()
    .eq("status", "active")
    .order("start_time", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    // No active session is fine — not an error
    return null;
  }

  return data as Session;
}
