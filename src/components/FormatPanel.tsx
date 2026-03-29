"use client";
"use client";
import { Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { List, ListOrdered, CheckSquare, Quote, Code as CodeIcon, Minus } from "lucide-react";

type FormatPanelProps = {
  editor: Editor;
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
};

const COLORS = [
  "var(--fg)", "var(--accent)", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#f43f5e"
];

export function FormatPanel({ editor, isOpen, onClose, documentId }: FormatPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [docFont, setDocFont] = useState("system");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`stride-doc-font-${documentId}`);
      if (saved) {
        setDocFont(saved);
      } else {
        setDocFont("system");
      }
    }
  }, [documentId]);

  useEffect(() => {
    const fontMap: Record<string, string> = {
      system: "var(--font-app)",
      serif: "Georgia, serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    };
    // Apply font to the wrapper or just inject a style tag for .ProseMirror inside this doc
    const applyFont = fontMap[docFont] || fontMap.system;
    
    // Applies font directly to the ProseMirror contenteditable element
    try {
      if (editor && editor.view && editor.view.dom) {
        editor.view.dom.style.fontFamily = applyFont;
      }
    } catch (e) {
      console.warn("Tiptap view not ready in FormatPanel:", e);
    }
  }, [docFont, editor]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      // Allow clicking inside Editor without closing the panel?
      // "Clicking outside the panel (but not on the Aa button itself) closes it"
      // If we close on any click outside, clicking the editor also closes it.
      // Usually users want to format while the panel is open. No, Craft's panel usually stays open until you toggle it.
      // Let's only close if it's outside both panel and editor, or maybe just leave it floating.
      // Prompt says: "Clicking outside the panel (but not on the Aa button itself) closes it".
      if (isOpen && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Exclude the Aa button
        if ((e.target as Element).closest('[data-format-trigger]')) return;
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    if (isOpen) {
      // small delay to avoid capturing the trigger click
      setTimeout(() => window.addEventListener("mousedown", handleClickOutside), 10);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        bottom: 16,
        width: 260,
        background: "var(--bg-card)",
        backdropFilter: "var(--glass-blur-card)",
        WebkitBackdropFilter: "var(--glass-blur-card)",
        border: "1px solid var(--glass-border)",
        borderTop: "1px solid var(--glass-border-top)",
        borderRadius: 16,
        boxShadow: "var(--shadow-float)",
        zIndex: 100,
        padding: "20px 16px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 28,
        animation: "drawer-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both"
      }}
    >
      <Section label="TITLES">
        <div className="flex flex-col gap-1">
          <TypeButton label="Title" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} style={{ fontSize: 20, fontWeight: 700 }} />
          <TypeButton label="Subtitle" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} style={{ fontSize: 16, fontWeight: 600 }} />
          <TypeButton label="Heading" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} style={{ fontSize: 14, fontWeight: 600 }} />
        </div>
      </Section>

      <Section label="CONTENT">
        <div className="flex flex-col gap-1">
          <TypeButton label="Strong" onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} style={{ fontWeight: 600 }} />
          <TypeButton label="Body" onClick={() => { editor.chain().focus().setParagraph().unsetMark('textStyle').run(); }} isActive={editor.isActive('paragraph') && !editor.isActive('textStyle')} />
          <TypeButton label="Caption" onClick={() => { editor.chain().focus().setParagraph().setMark('textStyle', { fontSize: "12" }).run(); }} isActive={editor.isActive('textStyle', { fontSize: "12" })} style={{ fontSize: 12, color: "var(--fg-muted)" }} />
        </div>
      </Section>

      <Section label="FONT">
        <div className="flex bg-[var(--bg-subtle)] p-1 rounded-[10px] border border-[var(--border)]">
          {(['system', 'serif', 'mono']).map(f => (
            <button
              key={f}
              onClick={() => {
                setDocFont(f);
                localStorage.setItem(`stride-doc-font-${documentId}`, f);
              }}
              className="flex-1 py-1.5 text-xs font-medium rounded-lg capitalize transition-all"
              style={{
                background: docFont === f ? "var(--bg-card)" : "transparent",
                color: docFont === f ? "var(--fg)" : "var(--fg-faint)",
                boxShadow: docFont === f ? "var(--shadow-sm)" : "none"
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </Section>

      <Section label="COLOR">
        <div className="grid grid-cols-4 gap-2 px-1">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => editor.chain().focus().setColor(c).run()}
              className="w-8 h-8 rounded-full hover:scale-110 transition-transform mx-auto"
              style={{
                background: c.replace("var(--fg)", "currentColor").replace("var(--accent)", "var(--accent)"),
                border: "1px solid var(--border-mid)",
                boxShadow: editor.isActive('textStyle', { color: c }) ? "0 0 0 2px var(--bg-card), 0 0 0 4px var(--accent)" : "none"
              }}
            />
          ))}
        </div>
      </Section>

      <Section label="FORMATTING">
        <div className="grid grid-cols-2 gap-2">
          <FormatBtn icon={<List size={16} />} label="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} />
          <FormatBtn icon={<ListOrdered size={16} />} label="Numbered" onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} />
          <FormatBtn icon={<CheckSquare size={16} />} label="Task" onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} />
          <FormatBtn icon={<Quote size={16} />} label="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} />
          <FormatBtn icon={<CodeIcon size={16} />} label="Code" onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} />
          <FormatBtn icon={<Minus size={16} />} label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()} isActive={false} />
        </div>
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-[var(--fg-faint)] mb-2 uppercase tracking-widest">{label}</div>
      {children}
    </div>
  );
}

function TypeButton({ label, onClick, isActive, style }: { label: string, onClick: () => void, isActive: boolean, style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 rounded-xl transition-colors text-sm"
      style={{
        background: isActive ? "var(--bg-active)" : "transparent",
        color: isActive ? "var(--accent)" : "var(--fg)",
        ...style
      }}
    >
      {label}
    </button>
  );
}

function FormatBtn({ icon, label, onClick, isActive }: { icon: React.ReactNode, label: string, onClick: () => void, isActive: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all"
      style={{
        borderColor: isActive ? "var(--accent)" : "var(--border)",
        background: isActive ? "var(--bg-active)" : "var(--bg-subtle)",
        color: isActive ? "var(--accent)" : "var(--fg-muted)"
      }}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
