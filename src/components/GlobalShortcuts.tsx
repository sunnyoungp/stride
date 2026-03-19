"use client";

import { useEffect } from "react";
import { useFocusStore } from "@/store/focusStore";

export const GlobalShortcuts = () => {
    // Pulling the state and actions from your updated focusStore
    const toggleZenMode = useFocusStore((state) => state.toggleZenMode);
    const isSetupModalOpen = useFocusStore((state) => state.isSetupModalOpen);
    const setSetupModalOpen = useFocusStore((state) => state.setSetupModalOpen);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // --- Safety Check ---
            // Don't trigger shortcuts if the user is typing in an input, textarea, or editor
            const isTyping =
                document.activeElement?.tagName === "INPUT" ||
                document.activeElement?.tagName === "TEXTAREA" ||
                (document.activeElement as HTMLElement)?.isContentEditable;

            if (isTyping) return;

            // --- 1. Global Zen Toggle (Cmd + \) ---
            if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
                e.preventDefault();
                toggleZenMode();
            }

            // --- 2. Focus Setup Modal (Cmd + J) ---
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
                e.preventDefault();
                setSetupModalOpen(!isSetupModalOpen);
            }
        };

        // Start listening
        window.addEventListener("keydown", handleKeyDown);

        // Stop listening if the component is removed
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggleZenMode, isSetupModalOpen, setSetupModalOpen]);

    return null; // This component is invisible logic only
};