"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
      },
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #faf7f4)",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "#e8603c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 16px rgba(232,96,60,0.35)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 13 L8 3 L13 13"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1="5"
                y1="9.5"
                x2="11"
                y2="9.5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--fg, #1a1310)",
            }}
          >
            Stride
          </span>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--bg-card, #ffffff)",
            border: "1px solid var(--border-mid, rgba(30,20,10,0.11))",
            borderRadius: 20,
            padding: "40px 48px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            boxShadow: "0 12px 40px rgba(30,20,10,0.08)",
            minWidth: 320,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--fg, #1a1310)",
                margin: 0,
              }}
            >
              Welcome back
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "var(--fg-muted, #6b5f57)",
                margin: "8px 0 0",
              }}
            >
              Sign in to continue to Stride
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              padding: "12px 20px",
              borderRadius: 12,
              border: "1px solid var(--border-mid, rgba(30,20,10,0.11))",
              background: "var(--bg-card, #ffffff)",
              color: "var(--fg, #1a1310)",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 150ms ease",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "var(--bg-hover, rgba(30,20,10,0.04))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-card, #ffffff)";
            }}
          >
            {/* Google icon */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
