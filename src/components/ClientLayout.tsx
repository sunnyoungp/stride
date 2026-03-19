"use client";

import { useFocusStore } from "@/store/focusStore";
import { Sidebar } from "@/components/Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { QuickAdd } from "@/components/QuickAdd";
import { SettingsApplier } from "@/components/SettingsApplier";
import { GlobalShortcuts } from "@/components/GlobalShortcuts";
import { FocusSetupModal } from "@/components/FocusSetupModal";

import { FocusTunnel } from "@/components/FocusTunnel";

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
            <aside
                className={`h-screen flex-none border-r border-[var(--border)] transition-all duration-300 ease-in-out overflow-hidden ${isZenMode ? "w-0 opacity-0 border-none" : "w-[220px] opacity-100"
                    }`}
            >
                <Sidebar />
            </aside>

            <main className="h-screen flex-1 overflow-auto bg-[var(--bg)] p-8">
                {children}
            </main>

            <GlobalSearch />
            <QuickAdd />
            <SettingsApplier />
            <GlobalShortcuts />
            <FocusSetupModal />
        </div>
    );
}