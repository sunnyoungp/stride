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

// Floating panel shadow — used on both sidebar and content cards
const PANEL_SHADOW = "var(--shadow-panel)";
const PANEL_RADIUS = 12;

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
                        {/* Root canvas — carries the app background behind the floating panels */}
                        <div
                            className="flex h-screen w-screen overflow-hidden md:p-3 md:gap-3"
                            style={{ background: "var(--color-app-root-bg)" }}
                        >
                            {!hideSidebar && (
                                <aside
                                    className={`flex-none transition-all duration-300 ease-in-out overflow-hidden hidden md:block ${isZenMode ? "w-0 opacity-0" : "md:w-14 lg:w-[220px] opacity-100"}`}
                                    style={{
                                        background: "var(--sidebar-bg)",
                                        borderRadius: PANEL_RADIUS,
                                        boxShadow: PANEL_SHADOW,
                                    }}
                                >
                                    <Sidebar />
                                </aside>
                            )}
                            <main
                                className="flex-1 min-h-0 overflow-hidden min-w-0 flex flex-col md:pb-0"
                                style={{
                                    background: "var(--content-bg)",
                                    borderRadius: PANEL_RADIUS,
                                    boxShadow: PANEL_SHADOW,
                                    paddingBottom: "calc(56px + env(safe-area-inset-bottom))",
                                }}
                            >
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
            {/* Root canvas — carries the app background behind the floating panels */}
            <div
                className="flex h-screen w-screen overflow-hidden md:p-3 md:gap-3"
                style={{ background: "var(--color-app-root-bg)" }}
            >
                {/* Sidebar floating card: hidden on mobile, icon-only on md (768–1023px), full on lg (1024px+) */}
                {!hideSidebar && (
                    <aside
                        className={`flex-none transition-all duration-300 ease-in-out overflow-hidden hidden md:block ${isZenMode ? "w-0 opacity-0" : "md:w-14 lg:w-[220px] opacity-100"}`}
                        style={{
                            background: "var(--sidebar-bg)",
                            borderRadius: PANEL_RADIUS,
                            boxShadow: PANEL_SHADOW,
                        }}
                    >
                        <Sidebar />
                    </aside>
                )}

                {/* Content floating card: flex-1, overflow hidden — each page handles its own scroll */}
                <main
                    className="flex-1 min-h-0 overflow-hidden min-w-0 flex flex-col md:pb-0"
                    style={{
                        background: "var(--content-bg)",
                        borderRadius: PANEL_RADIUS,
                        boxShadow: PANEL_SHADOW,
                        paddingBottom: "calc(56px + env(safe-area-inset-bottom))",
                    }}
                >
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
