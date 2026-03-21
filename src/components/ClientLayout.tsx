"use client";

import { useFocusStore } from "@/store/focusStore";
import { Sidebar } from "@/components/Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { QuickAdd } from "@/components/QuickAdd";
import { SettingsApplier } from "@/components/SettingsApplier";
import { GlobalShortcuts } from "@/components/GlobalShortcuts";
import { FocusSetupModal } from "@/components/FocusSetupModal";
import { FocusTunnel } from "@/components/FocusTunnel";
import { BottomTabBar } from "@/components/BottomTabBar";
import { MobileFABs } from "@/components/MobileFABs";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const isZenMode = useFocusStore((state) => state.isZenMode);
    const focusState = useFocusStore((state) => state.focusState);

    if (focusState.isActive) {
        return (
            <>
                <FocusTunnel />
                <GlobalSearch />
                <QuickAdd />
                <SettingsApplier />
                <GlobalShortcuts />
                <FocusSetupModal />
            </>
        );
    }

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
            {/* Sidebar: hidden on mobile, icon-only on md (768–1023px), full on lg (1024px+) */}
            <aside
                className={`h-screen flex-none border-r border-[var(--border)] transition-all duration-300 ease-in-out overflow-hidden hidden md:block ${
                    isZenMode ? "w-0 opacity-0 border-none" : "md:w-14 lg:w-[220px] opacity-100"
                }`}
            >
                <Sidebar />
            </aside>

            {/* Main content: reduce padding on mobile, add bottom clearance for tab bar */}
            <main className="h-screen flex-1 overflow-auto bg-[var(--bg)] min-w-0 p-4 pb-20 md:p-8 md:pb-8">
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
    );
}