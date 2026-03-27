"use client";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/core";
import { Bold, Italic, Strikethrough, Code, Link as LinkIcon, Palette } from "lucide-react";
import { useState } from "react";

const COLORS = [
  "var(--fg)", "var(--accent)", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#f43f5e"
];

export function EditorBubbleMenu({ editor }: { editor: Editor }) {
  const [showColor, setShowColor] = useState(false);

  if (!editor) return null;

  const toggleLink = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const previousUrl = editor.getAttributes("link").href || "";
    const url = window.prompt("URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      className="flex items-center gap-1.5 p-1.5"
      style={{
        background: "var(--bg-card)",
        boxShadow: "var(--shadow-float)",
        border: "1px solid var(--border-mid)",
        borderRadius: 20
      }}
    >
      <div className="flex items-center gap-1">
        <MenuButton
          isActive={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          icon={<Bold size={15} />}
        />
        <MenuButton
          isActive={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          icon={<Italic size={15} />}
        />
        <MenuButton
          isActive={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          icon={<Strikethrough size={15} />}
        />
        <MenuButton
          isActive={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          icon={<Code size={15} />}
        />
      </div>

      <div className="h-4 w-[1px] mx-1" style={{ background: "var(--border-strong)" }} />

      <div className="flex items-center gap-1 relative">
        {showColor ? (
          <div className="flex items-center gap-1.5 px-1">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  editor.chain().focus().setColor(c).run();
                  setShowColor(false);
                }}
                className="w-5 h-5 rounded-full hover:scale-110 transition-transform"
                style={{ background: c.replace("var(--fg)", "currentColor").replace("var(--accent)", "var(--accent)"), border: "1px solid var(--border)" }}
              />
            ))}
            <button
              onClick={() => setShowColor(false)}
              className="w-6 h-6 flex items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: "var(--fg-faint)" }}
            >
              ×
            </button>
          </div>
        ) : (
          <MenuButton
            isActive={false}
            onClick={() => setShowColor(true)}
            icon={<Palette size={15} />}
          />
        )}

        {!showColor && (
          <MenuButton
            isActive={editor.isActive("link")}
            onClick={toggleLink}
            icon={<LinkIcon size={15} />}
          />
        )}
      </div>
    </BubbleMenu>
  );
}

function MenuButton({ isActive, onClick, icon }: { isActive: boolean, onClick: () => void, icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
      style={{
        background: isActive ? "var(--bg-active)" : "transparent",
        color: isActive ? "var(--accent)" : "var(--fg-muted)"
      }}
    >
      {icon}
    </button>
  );
}
