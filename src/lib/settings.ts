"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Loads user settings from Supabase into localStorage.
 * Called once after the user's session is confirmed.
 * Supabase values take precedence over any stale localStorage values.
 */
export async function loadSettings(): Promise<void> {
  try {
    const supabase = createClient();
    const { data: rows } = await supabase.from("user_settings").select("key, value");
    if (!rows) return;
    for (const row of rows) {
      if (typeof row.key === "string" && typeof row.value === "string") {
        localStorage.setItem(row.key, row.value);
        window.dispatchEvent(new StorageEvent("storage", { key: row.key, newValue: row.value }));
      }
    }
  } catch {
    // Non-critical — localStorage defaults are used as fallback
  }
}

/**
 * Persists a single setting.
 * Writes to localStorage immediately (synchronous), dispatches a synthetic
 * StorageEvent so other components on the same page can react, then
 * background-syncs to Supabase.
 */
export async function saveSettings(key: string, value: string): Promise<void> {
  localStorage.setItem(key, value);
  window.dispatchEvent(new StorageEvent("storage", { key, newValue: value }));

  try {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user?.id;
    if (!userId) return;
    await supabase
      .from("user_settings")
      .upsert({ key, value, user_id: userId }, { onConflict: "user_id,key" });
  } catch {
    // Non-critical — localStorage already updated
  }
}
