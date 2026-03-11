"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useSectionStore } from "@/store/sectionStore";
import { useProjectStore } from "@/store/projectStore";
import { SectionContextMenu } from "@/components/SectionContextMenu";
import { ProjectContextMenu } from "@/components/ProjectContextMenu";
import type { TaskSection, Project } from "@/types/index";

type NavItem = {
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Tasks", href: "/tasks" },
  { label: "Calendar", href: "/calendar" },
  { label: "Documents", href: "/documents" },
];

function SidebarHeading({ 
  children, 
  id, 
  isCollapsed, 
  onToggle 
}: { 
  children: React.ReactNode;
  id?: string;
  isCollapsed?: boolean;
  onToggle?: (id: string) => void;
}) {
  if (!id || !onToggle) {
    return (
      <div className="px-4 pt-6 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className="flex w-full items-center px-4 pt-6 pb-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
    >
      <span className="mr-2 text-[10px]">{isCollapsed ? "▶" : "▼"}</span>
      {children}
    </button>
  );
}

function SidebarLink({
  href,
  children,
  onContextMenu,
}: {
  href: string;
  children: React.ReactNode;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <Link
      href={href}
      onContextMenu={onContextMenu}
      className="mx-2 flex h-9 items-center rounded-md px-3 text-sm text-zinc-200 hover:bg-white/5 hover:text-white"
    >
      {children}
    </Link>
  );
}

export function Sidebar() {
  const sections = useSectionStore((s) => s.sections);
  const loadSections = useSectionStore((s) => s.loadSections);
  const createSection = useSectionStore((s) => s.createSection);
  
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [addingSubsectionSectionId, setAddingSubsectionSectionId] = useState<string | null>(null);
  const [draftSubsection, setDraftSubsection] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<string[]>([]);

  const subsections = useSectionStore((s) => s.subsections);
  const createSubsection = useSectionStore((s) => s.createSubsection);

  const [sectionMenu, setSectionMenu] = useState<{
    section: TaskSection;
    x: number;
    y: number;
  } | null>(null);

  const [projectMenu, setProjectMenu] = useState<{
    project: Project;
    x: number;
    y: number;
  } | null>(null);

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const isSectionsCollapsed = collapsedSections.includes("sections");
  const isProjectsCollapsed = collapsedSections.includes("projects");

  useEffect(() => {
    void loadSections();
    void loadProjects();
  }, [loadSections, loadProjects]);

  return (
    <div className="flex h-full flex-col bg-[#111] text-zinc-100">
      <div className="px-4 pt-5 pb-4">
        <div className="text-xl font-bold tracking-tight">Stride</div>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <SidebarLink key={item.href} href={item.href}>
            {item.label}
          </SidebarLink>
        ))}
      </nav>

      <SidebarHeading id="sections" isCollapsed={isSectionsCollapsed} onToggle={toggleSection}>
        Sections
      </SidebarHeading>
      <div className="flex flex-col gap-1">
        {!isSectionsCollapsed && sections.map((section) => (
          <div key={section.id}>
            <SidebarLink 
              href={`/tasks?sectionId=${section.id}`}
              onContextMenu={(e) => {
                e.preventDefault();
                setSectionMenu({ section, x: e.clientX, y: e.clientY });
              }}
            >
              <span className="mr-2">{section.icon ?? "•"}</span>
              <span className="truncate">{section.title}</span>
            </SidebarLink>
            
            {/* Subsections under this section */}
            <div className="pl-6 flex flex-col gap-1">
              {subsections.filter(s => s.sectionId === section.id).map(sub => (
                <Link
                  key={sub.id}
                  href={`/tasks?sectionId=${section.id}&subsectionId=${sub.id}`}
                  className="flex h-7 items-center rounded-md px-3 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                >
                  <span className="truncate"># {sub.title}</span>
                </Link>
              ))}
              
              {addingSubsectionSectionId === section.id && (
                <div className="px-2 py-1">
                  <input
                    autoFocus
                    value={draftSubsection}
                    onChange={(e) => setDraftSubsection(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setAddingSubsectionSectionId(null);
                        setDraftSubsection("");
                      }
                      if (e.key === "Enter") {
                        const title = draftSubsection.trim();
                        if (title) void createSubsection(title, section.id);
                        setAddingSubsectionSectionId(null);
                        setDraftSubsection("");
                      }
                    }}
                    placeholder="Subsection..."
                    className="h-7 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200 outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="mt-1 px-2">
          {creating ? (
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setCreating(false);
                  setDraft("");
                }
                if (e.key === "Enter") {
                  const title = draft.trim();
                  if (!title) return;
                  void (async () => {
                    await createSection(title);
                    setDraft("");
                    setCreating(false);
                  })();
                }
              }}
              autoFocus
              placeholder="Section name"
              className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-500"
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-9 w-full items-center rounded-md px-3 text-sm text-zinc-300 hover:bg-white/5 hover:text-white"
            >
              + New Section
            </button>
          )}
        </div>
      </div>

      <SidebarHeading id="projects" isCollapsed={isProjectsCollapsed} onToggle={toggleSection}>
        Projects
      </SidebarHeading>
      <div className="flex flex-col gap-1">
        {!isProjectsCollapsed && projects.map((p) => (
          <SidebarLink 
            key={p.id} 
            href={`/projects/${encodeURIComponent(p.title)}`}
            onContextMenu={(e) => {
              e.preventDefault();
              setProjectMenu({ project: p, x: e.clientX, y: e.clientY });
            }}
          >
            {p.title}
          </SidebarLink>
        ))}
      </div>

      <div className="mt-auto pb-4 pt-6">
        <div className="mx-4 mb-3 h-px bg-white/10" />
        <SidebarLink href="/settings">Settings</SidebarLink>
      </div>

      {sectionMenu && (
        <SectionContextMenu
          section={sectionMenu.section}
          position={{ x: sectionMenu.x, y: sectionMenu.y }}
          onAddSubsection={() => setAddingSubsectionSectionId(sectionMenu.section.id)}
          onClose={() => setSectionMenu(null)}
        />
      )}

      {projectMenu && (
        <ProjectContextMenu
          project={projectMenu.project}
          position={{ x: projectMenu.x, y: projectMenu.y }}
          onClose={() => setProjectMenu(null)}
        />
      )}
    </div>
  );
}
