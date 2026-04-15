import { createBrowserClient } from "@supabase/ssr";
import { isDemoMode, setDemoMode, createDemoQueryBuilder, DEMO_USER_ID } from "@/lib/demo/storage";

// Real Supabase singleton
let _real: ReturnType<typeof createBrowserClient> | null = null;

function getRealClient() {
  if (!_real) {
    _real = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _real;
}

// Minimal demo session shape (satisfies `session?.user?.id`)
const DEMO_SESSION = {
  user: {
    id: DEMO_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "demo@stride.app",
    app_metadata: {},
    user_metadata: { name: "Demo User" },
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
  },
  access_token:  "demo_token",
  refresh_token: "demo_refresh",
  token_type:    "bearer",
  expires_in:    9999999,
  expires_at:    9999999999,
};

/**
 * Smart proxy: routes `.from()` and `.auth` calls to demo localStorage when
 * demo mode is active, and to real Supabase otherwise.
 *
 * The proxy object is a stable singleton so stores that capture it at module-
 * init (`const supabase = createClient()`) will pick up demo mode changes
 * that happen after their module loads.
 */
const _proxy = {
  from(table: string) {
    if (isDemoMode()) return createDemoQueryBuilder(table);
    return getRealClient().from(table);
  },

  auth: {
    getSession() {
      if (isDemoMode()) {
        return Promise.resolve({ data: { session: DEMO_SESSION }, error: null });
      }
      return getRealClient().auth.getSession();
    },

    /**
     * Always subscribe to REAL auth changes — even in demo mode — so that a
     * visitor signing in with Google exits demo mode automatically.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onAuthStateChange(callback: (event: string, session: unknown) => void) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return getRealClient().auth.onAuthStateChange((authEvent: any, session: any) => {
        if (session) {
          // Real user authenticated → exit demo mode so stores use Supabase
          setDemoMode(false);
        }
        callback(authEvent as string, session);
      });
    },

    async signOut() {
      if (isDemoMode()) {
        setDemoMode(false);
        // No real session to sign out from — just clear the flag
        return { error: null };
      }
      return getRealClient().auth.signOut();
    },

    signInWithOAuth(opts: unknown) {
      // Always exit demo mode when user attempts real sign-in
      setDemoMode(false);
      return getRealClient().auth.signInWithOAuth(opts as Parameters<ReturnType<typeof createBrowserClient>["auth"]["signInWithOAuth"]>[0]);
    },
  },
} as unknown as ReturnType<typeof createBrowserClient>;

export function createClient() {
  return _proxy;
}
