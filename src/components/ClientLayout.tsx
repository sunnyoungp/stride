"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useFocusStore } from "@/store/focusStore";
import { useAuthStore } from "@/store/authStore";
import { createClient } from "@/lib/supabase/client";
import { useTaskStore } from "@/store/taskStore";
import { useProjectStore } from "@/store/projectStore";
import { useSectionStore } from "@/store/sectionStore";
import { useDocumentStore } from "@/store/documentStore";
import { useTimeBlockStore } from "@/store/timeBlockStore";
import { useRoutineTemplateStore } from "@/store/routineTemplateStore";
import { setDemoMode } from "@/lib/demo/storage";
import { initDemoData } from "@/lib/demo/data";
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
import { ConfirmDialog } from "@/components/ConfirmDialog";

const PANEL_RADIUS = 14;

// Reusable blur backdrop — sits behind content, never creates a containing block for fixed children
const GlassBackdrop = ({ radius = PANEL_RADIUS }: { radius?: number }) => (
    <div
        aria-hidden="true"
        style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            background: "var(--bg-panel)",
            backdropFilter: "var(--glass-blur-panel)",
            WebkitBackdropFilter: "var(--glass-blur-panel)",
            pointerEvents: "none",
            zIndex: 0,
        }}
    />
);

// Shared panel style — NO backdropFilter here, that lives in GlassBackdrop
const panelStyle = (radius: number): React.CSSProperties => ({
    position: "relative",
    border: "1px solid var(--glass-border)",
    borderTop: "1px solid var(--glass-border-top)",
    boxShadow: "var(--glass-shadow-panel)",
    borderRadius: radius,
});

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const hideSidebar = pathname.startsWith("/login") || pathname.startsWith("/auth");
    const isZenMode = useFocusStore((state) => state.isZenMode);
    const focusState = useFocusStore((state) => state.focusState);
    const isMinimized = useFocusStore((state) => state.isMinimized);
    const setUser = useAuthStore((state) => state.setUser);
    const setInitialized = useAuthStore((state) => state.setInitialized);

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getSession().then(({ data }: any) => {
            const user = data.session?.user ?? null;
            setUser(user);
            setInitialized(true);
            if (user) {
                void loadSettings();
                void useTaskStore.getState().loadTasks();
                void useProjectStore.getState().loadProjects();
            } else {
                // No session → enter demo mode and inject data directly into stores
                setDemoMode(true);
                const demo = initDemoData();

                useSectionStore.setState({
                    sections: demo.sections,
                    subsections: [],
                    deletedSections: [],
                    sectionsLoaded: true,
                    subsectionsLoaded: true,
                    isLoading: false,
                });
                useTaskStore.setState({ tasks: demo.tasks, isLoading: false });
                useDocumentStore.setState({ documents: demo.documents });
                useProjectStore.setState({ projects: demo.projects });
                useTimeBlockStore.setState({ timeBlocks: demo.timeBlocks });
                useRoutineTemplateStore.setState({
                    templates: demo.templates,
                    isLoaded: true,
                    isLoading: false,
                });
            }
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
            setUser(session?.user ?? null);
        });
        return () => subscription.unsubscribe();
    }, [setUser]);

    if (focusState.isActive) {
        return (
            <ThemeProvider>
                <div className={isMinimized ? "hidden" : ""}>
                    <FocusTunnel />
                </div>

                {isMinimized && (
                    <>
                        <div
                            className="flex h-screen w-screen overflow-hidden md:p-3 md:gap-3"
                            style={{ background: "var(--bg-app)" }}
                        >
                            {!hideSidebar && (
                                <aside
                                    className={`flex-none transition-all duration-300 ease-in-out overflow-hidden hidden md:block ${isZenMode ? "w-0 opacity-0" : "md:w-14 lg:w-[220px] opacity-100"}`}
                                    style={panelStyle(PANEL_RADIUS)}
                                >
                                    <GlassBackdrop />
                                    <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
                                        <Sidebar />
                                    </div>
                                </aside>
                            )}
                            <main
                                className="flex-1 min-h-0 overflow-hidden min-w-0 flex flex-col md:pb-0"
                                style={{
                                    ...panelStyle(PANEL_RADIUS),
                                    paddingBottom: "var(--main-pb)",
                                }}
                            >
                                <GlassBackdrop />
                                <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                                    {children}
                                </div>
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
                <ConfirmDialog />
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider>
            <div
                className="flex h-screen w-screen overflow-hidden md:p-3 md:gap-3"
                style={{ background: "var(--bg-app)" }}
            >
                {!hideSidebar && (
                    <aside
                        className={`flex-none transition-all duration-300 ease-in-out overflow-hidden hidden md:block ${isZenMode ? "w-0 opacity-0" : "md:w-14 lg:w-[220px] opacity-100"}`}
                        style={panelStyle(PANEL_RADIUS)}
                    >
                        <GlassBackdrop />
                        <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
                            <Sidebar />
                        </div>
                    </aside>
                )}

                <main
                    className="flex-1 min-h-0 overflow-hidden min-w-0 flex flex-col"
                    style={{
                        ...panelStyle(PANEL_RADIUS),
                        paddingBottom: "var(--main-pb)",
                    }}
                >
                    <GlassBackdrop />
                    <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                        {children}
                    </div>
                </main>

                <BottomTabBar />
                <MobileFABs />

                <GlobalSearch />
                <QuickAdd />
                <SettingsApplier />
                <GlobalShortcuts />
                <FocusSetupModal />
                <ConfirmDialog />
            </div>
        </ThemeProvider>
    );
}