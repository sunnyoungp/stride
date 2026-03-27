"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useFocusStore } from "@/store/focusStore";
import { useAuthStore } from "@/store/authStore";
import { createClient } from "@/lib/supabase/client";
import { loadSettings } from "@/lib/settings";
import { Sidebar } from "@/components/Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { QuickAdd } from "@/components/QuickAdd";
import { SettingsApplier } from "@/components/SettingsApplier";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GlobalShortcuts } from "@/components/GlobalShortcuts";
import { FocusSetupModal } from "@/components/FocusSetupModal";
import { FocusTunnel } from "@/components/FocusTunnel";
import { FocusPill } from "@/components/FocusPill";
import { BottomTabBar } from "@/components/BottomTabBar";
import { MobileFABs } from "@/components/MobileFABs";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const hideSidebar = pathname === "/login";
    const isZenMode = useFocusStore((state) => state.isZenMode);
    const focusState = useFocusStore((state) => state.focusState);
    const isMinimized = useFocusStore((state) => state.isMinimized);
    const setUser = useAuthStore((state) => state.setUser);

    useEffect(() => {
        const supabase = createClient();
        // Hydrate store with current session
        supabase.auth.getSession().then(({ data }) => {
            setUser(data.session?.user ?? null);
            if (data.session?.user) void loadSettings();
        });
        // Keep store in sync on auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });
        return () => subscription.unsubscribe();
    }, [setUser]);

    if (focusState.isActive) {
        return (
            <ThemeProvider>
                {/* Always keep FocusTunnel mounted to preserve timer state; hide via CSS when minimized */}
                <div className={isMinimized ? "hidden" : ""}>
                    <FocusTunnel />
                </div>

                {/* Minimized: show normal app layout + floating pill */}
                {isMinimized && (
                    <>
                        <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
                            {!hideSidebar && (
                                <aside
                                    className={`h-screen flex-none border-r border-[var(--border)] transition-all duration-300 ease-in-out overflow-hidden hidden md:block ${isZenMode ? "w-0 opacity-0 border-none" : "md:w-14 lg:w-[220px] opacity-100"}`}
                                >
                                    <Sidebar />
                                </aside>
                            )}
                            <main className="flex-1 min-h-0 overflow-hidden bg-[var(--bg)] min-w-0 flex flex-col md:pb-0" style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom))" }}>
                                {children}
                            </main>
                            <BottomTabBar />
                            <MobileFABs />
                        </div>
                        <FocusPill />
                    </>
                )}

                <GlobalSearch />
                <QuickAdd />
                <SettingsApplier />
                <GlobalShortcuts />
                <FocusSetupModal />
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider>
            <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
                {/* Sidebar: hidden on mobile, icon-only on md (768–1023px), full on lg (1024px+) */}
                {!hideSidebar && (
                    <aside
                        className={`h-screen flex-none border-r border-[var(--border)] transition-all duration-300 ease-in-out overflow-hidden hidden md:block ${isZenMode ? "w-0 opacity-0 border-none" : "md:w-14 lg:w-[220px] opacity-100"
                            }`}
                    >
                        <Sidebar />
                    </aside>
                )}

                {/* Main content: flex-1, overflow hidden — each page handles its own scroll */}
                <main className="flex-1 min-h-0 overflow-hidden bg-[var(--bg)] min-w-0 flex flex-col md:pb-0" style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom))" }}>
                    {children}
                </main>

                {/* Mobile bottom navigation and FABs */}
                <BottomTabBar />
                <MobileFABs />

                <GlobalSearch />
                <QuickAdd />
                <SettingsApplier />
                <GlobalShortcuts />
                <FocusSetupModal />
            </div>
        </ThemeProvider>
    );
}