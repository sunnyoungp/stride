"use client";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/core";
import { Bold, Italic, Strikethrough, Code, Link as LinkIcon, Palette, Calendar, Check, X } from "lucide-react";
import { useRef, useState } from "react";
import { EDITOR_COLORS } from "@/lib/colorPalette";

export function EditorBubbleMenu({ editor }: { editor: Editor }) {
  const [showColor, setShowColor] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showDateInput, setShowDateInput] = useState(false);
  const [dateValue, setDateValue] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const openLinkInput = () => {
    const previousUrl = editor.isActive("link")
      ? editor.getAttributes("link").href || ""
      : "";
    setLinkUrl(previousUrl);
    setShowLinkInput(true);
    setShowColor(false);
    setShowDateInput(false);
    setTimeout(() => linkInputRef.current?.focus(), 50);
  };

  const applyLink = () => {
    if (linkUrl.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl.trim() }).run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  };

  const cancelLink = () => {
    setShowLinkInput(false);
    setLinkUrl("");
    editor.chain().focus().run();
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
    setShowLinkInput(false);
    setLinkUrl("");
  };

  const openDateInput = () => {
    setDateValue(new Date().toISOString().split("T")[0]);
    setShowDateInput(true);
    setShowColor(false);
    setShowLinkInput(false);
    setTimeout(() => dateInputRef.current?.focus(), 50);
  };

  const applyDate = () => {
    if (dateValue) {
      const event = new CustomEvent("stride-move-block", { detail: { date: dateValue, editor } });
      window.dispatchEvent(event);
    }
    setShowDateInput(false);
    setDateValue("");
  };

  const cancelDate = () => {
    setShowDateInput(false);
    setDateValue("");
    editor.chain().focus().run();
  };

  // Inline input mode — link URL
  if (showLinkInput) {
    return (
      <BubbleMenu
        editor={editor}
        options={{ placement: "top" }}
        className="flex items-center gap-1.5 p-1.5"
        style={{
          background: "var(--bg-subtle)",
          backdropFilter: "var(--glass-blur-card)",
          WebkitBackdropFilter: "var(--glass-blur-card)",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--glass-border)",
          borderTop: "1px solid var(--glass-border-top)",
          borderRadius: 20,
        }}
      >
        <input
          ref={linkInputRef}
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); applyLink(); }
            if (e.key === "Escape") cancelLink();
          }}
          placeholder="https://…"
          className="outline-none text-sm"
          style={{
            background: "transparent",
            color: "var(--fg)",
            width: 180,
            padding: "4px 8px",
            fontSize: 13,
          }}
        />
        <MenuButton isActive={false} onClick={applyLink} icon={<Check size={14} />} />
        {editor.isActive("link") && (
          <MenuButton isActive={false} onClick={removeLink} icon={<X size={14} />} />
        )}
        {!editor.isActive("link") && (
          <MenuButton isActive={false} onClick={cancelLink} icon={<X size={14} />} />
        )}
      </BubbleMenu>
    );
  }

  // Inline input mode — date
  if (showDateInput) {
    return (
      <BubbleMenu
        editor={editor}
        options={{ placement: "top" }}
        className="flex items-center gap-1.5 p-1.5"
        style={{
          background: "var(--bg-subtle)",
          backdropFilter: "var(--glass-blur-card)",
          WebkitBackdropFilter: "var(--glass-blur-card)",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--glass-border)",
          borderTop: "1px solid var(--glass-border-top)",
          borderRadius: 20,
        }}
      >
        <input
          ref={dateInputRef}
          type="date"
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); applyDate(); }
            if (e.key === "Escape") cancelDate();
          }}
          className="outline-none text-sm"
          style={{
            background: "transparent",
            color: "var(--fg)",
            padding: "4px 8px",
            fontSize: 13,
          }}
        />
        <MenuButton isActive={false} onClick={applyDate} icon={<Check size={14} />} />
        <MenuButton isActive={false} onClick={cancelDate} icon={<X size={14} />} />
      </BubbleMenu>
    );
  }

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}

      className="flex items-center gap-1.5 p-1.5"
      style={{
        background: "var(--bg-subtle)",
        backdropFilter: "var(--glass-blur-card)",
        WebkitBackdropFilter: "var(--glass-blur-card)",
        boxShadow: "var(--shadow-lg)",
        border: "1px solid var(--glass-border)",
        borderTop: "1px solid var(--glass-border-top)",
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
            {EDITOR_COLORS.map(c => (
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
            onClick={editor.isActive("link") ? removeLink : openLinkInput}
            icon={<LinkIcon size={15} />}
          />
        )}

        {!showColor && (
          <MenuButton
            isActive={false}
            onClick={openDateInput}
            icon={<Calendar size={15} />}
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
