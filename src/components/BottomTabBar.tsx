"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// All navigable routes with their icons (20px for tabs, can reuse for more sheet)
const ALL_NAV = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg width="20" height="20" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="1" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".9"/>
        <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".5"/>
        <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".5"/>
        <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".9"/>
      </svg>
    ),
  },
  {
    href: "/notes",
    label: "Notes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 15 15" fill="none">
        <rect x="2" y="1.5" width="11" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <line x1="4.5" y1="5"   x2="10.5" y2="5"   stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".7"/>
        <line x1="4.5" y1="7.5" x2="9"    y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".7"/>
        <line x1="4.5" y1="10"  x2="8"    y2="10"  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".7"/>
      </svg>
    ),
  },
  {
    href: "/inbox",
    label: "Inbox",
    icon: (
      <svg width="20" height="20" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="7" width="13" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M1 7l2.5-5h8L14 7" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <line x1="5" y1="7" x2="5" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
        <line x1="5" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
        <line x1="10" y1="10" x2="10" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
      </svg>
    ),
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: (
      <svg width="20" height="20" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="4.5" y="1" width="1.4" height="3" rx=".7" fill="currentColor"/>
        <rect x="9.1" y="1" width="1.4" height="3" rx=".7" fill="currentColor"/>
        <line x1="1" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.2"/>
        <circle cx="5" cy="9.5" r="1" fill="currentColor" opacity=".6"/>
        <circle cx="7.5" cy="9.5" r="1" fill="currentColor" opacity=".6"/>
        <circle cx="10" cy="9.5" r="1" fill="currentColor" opacity=".6"/>
      </svg>
    ),
  },
  {
    href: "/next7",
    label: "Next 7 Days",
    icon: (
      <svg width="20" height="20" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="4.5" y="1" width="1.4" height="3" rx=".7" fill="currentColor"/>
        <rect x="9.1" y="1" width="1.4" height="3" rx=".7" fill="currentColor"/>
        <line x1="1" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.2"/>
        <line x1="7.5" y1="8.5" x2="7.5" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="7.5" y1="11" x2="9.5" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: (
      <svg width="20" height="20" viewBox="0 0 15 15" fill="none">
        <circle cx="2.5" cy="4" r="1" fill="currentColor"/>
        <circle cx="2.5" cy="7.5" r="1" fill="currentColor"/>
        <circle cx="2.5" cy="11" r="1" fill="currentColor"/>
        <rect x="5" y="3.25" width="8" height="1.5" rx=".75" fill="currentColor" opacity=".8"/>
        <rect x="5" y="6.75" width="6" height="1.5" rx=".75" fill="currentColor" opacity=".8"/>
        <rect x="5" y="10.25" width="7" height="1.5" rx=".75" fill="currentColor" opacity=".8"/>
      </svg>
    ),
  },
  {
    href: "/documents",
    label: "Documents",
    icon: (
      <svg width="20" height="20" viewBox="0 0 15 15" fill="none">
        <path d="M3 1.5h6l3 3V13a.5.5 0 01-.5.5h-8.5a.5.5 0 01-.5-.5V2a.5.5 0 01.5-.5z" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M9 1.5V4.5H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="5" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
        <line x1="5" y1="9.5" x2="9" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
      </svg>
    ),
  },
];

const SETTINGS_ITEM = {
  href: "/settings",
  label: "Settings",
  icon: (
    <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1.1 1.1M10 10l1.1 1.1M2.9 11.1L4 10M10 4l1.1-1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
};

// Default split: first 4 items as primary tabs, rest in More
const DEFAULT_TABS = ALL_NAV.slice(0, 4);
const DEFAULT_MORE = [...ALL_NAV.slice(4), SETTINGS_ITEM];

type NavItem = (typeof ALL_NAV)[number];

function computeFromConfig(): { tabs: NavItem[]; more: (NavItem | typeof SETTINGS_ITEM)[] } {
  if (typeof window === "undefined") return { tabs: DEFAULT_TABS, more: DEFAULT_MORE };
  try {
    const raw = localStorage.getItem("stride-nav-config");
    if (!raw) return { tabs: DEFAULT_TABS, more: DEFAULT_MORE };
    const config = JSON.parse(raw) as { id: string; visible: boolean; order: number }[];
    const sorted = config.filter((c) => c.visible).sort((a, b) => a.order - b.order);
    const visible = sorted
      .map((c) => ALL_NAV.find((n) => n.href === c.id))
      .filter(Boolean) as NavItem[];
    return {
      tabs: visible.slice(0, 4),
      more: [...visible.slice(4), SETTINGS_ITEM],
    };
  } catch {
    return { tabs: DEFAULT_TABS, more: DEFAULT_MORE };
  }
}

export function BottomTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [{ tabs, more }, setNav] = useState<{ tabs: NavItem[]; more: (NavItem | typeof SETTINGS_ITEM)[] }>(
    () => ({ tabs: DEFAULT_TABS, more: DEFAULT_MORE })
  );

  useEffect(() => {
    setNav(computeFromConfig());
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "stride-nav-config") setNav(computeFromConfig());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const isMoreActive = more.some((item) => isActive(item.href));

  return (
    <>
      {/* Bottom tab bar — mobile only */}
      <nav
        className="md:hidden fixed z-50 flex items-center shadow-lg transition-transform duration-300 left-0 right-0 bottom-0"
        style={{
          background: "var(--bg-card)",
          borderTop: "1px solid var(--border-mid)",
          height: "calc(72px + env(safe-area-inset-bottom))",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
        }}
      >
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors"
              style={{ color: active ? "var(--accent)" : "var(--fg-faint)" }}
            >
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}

        {/* More tab */}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors"
          style={{ color: isMoreActive ? "var(--accent)" : "var(--fg-faint)" }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <circle cx="4" cy="10" r="1.5"/>
            <circle cx="10" cy="10" r="1.5"/>
            <circle cx="16" cy="10" r="1.5"/>
          </svg>
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>

      {/* More slide-up sheet */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-48 backdrop-fade"
            style={{ background: "rgba(0,0,0,0.3)" }}
            onClick={() => setMoreOpen(false)}
          />

          {/* Sheet panel */}
          <div
            className="md:hidden fixed left-0 right-0 z-[51] rounded-t-2xl py-2"
            style={{
              bottom: "calc(72px + env(safe-area-inset-bottom))",
              background: "var(--bg-card)",
              border: "1px solid var(--border-mid)",
              boxShadow: "0 -4px 16px rgba(0,0,0,0.1)",
            }}
          >

            {more.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-4 px-6 transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    color: active ? "var(--accent)" : "var(--fg)",
                    height: "52px",
                  }}
                >
                  <span style={{ color: active ? "var(--accent)" : "var(--fg-faint)" }}>
                    {item.icon}
                  </span>
                  <span className="text-[15px] font-[470]">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
