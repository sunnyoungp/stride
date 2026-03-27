"use client";

import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { MutableRefObject } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SlashCmd = {
  id: string;
  label: string;
  desc: string;
  icon: string;
  run: (editor: Editor) => void;
};

export type SlashMenuState = { items: SlashCmd[]; activeIndex: number; rect: DOMRect } | null;

// ─── Commands ─────────────────────────────────────────────────────────────────

export const ALL_SLASH_CMDS: SlashCmd[] = [
  { id: "text",    label: "Text",          desc: "Plain paragraph",               icon: "¶",  run: (e) => e.chain().focus().setParagraph().run() },
  { id: "h1",      label: "Heading 1",     desc: "Large section header",          icon: "H1", run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: "h2",      label: "Heading 2",     desc: "Medium section header",         icon: "H2", run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: "h3",      label: "Heading 3",     desc: "Small section header",          icon: "H3", run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: "bullet",  label: "Bullet List",   desc: "Unordered list",                icon: "•",  run: (e) => e.chain().focus().toggleBulletList().run() },
  { id: "ordered", label: "Numbered List", desc: "Ordered list",                  icon: "1.", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { id: "task",    label: "Task",          desc: "Trackable checklist item",      icon: "☑",  run: (e) => e.chain().focus().toggleTaskList().run() },
  { id: "quote",   label: "Blockquote",    desc: "Highlighted quote block",       icon: "❝",  run: (e) => e.chain().focus().toggleBlockquote().run() },
  { id: "code",    label: "Code Block",    desc: "Code with syntax highlighting", icon: "<>", run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { id: "divider", label: "Divider",       desc: "Horizontal rule",               icon: "—",  run: (e) => e.chain().focus().setHorizontalRule().run() },
];

// ─── Extension factory ────────────────────────────────────────────────────────

/**
 * Creates the slash command Tiptap extension.
 * Pass refs/setters from the host component so the extension stays stable
 * across re-renders while always reading the latest menu state.
 */
export function createSlashCommandExtension(
  slashPropsRef: MutableRefObject<SuggestionProps<SlashCmd, SlashCmd> | null>,
  slashMenuRef: MutableRefObject<SlashMenuState>,
  setSlashMenu: (updater: SlashMenuState | ((prev: SlashMenuState) => SlashMenuState)) => void,
) {
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashCmd, SlashCmd>({
          editor: this.editor,
          char: "/",
          allowSpaces: false,
          startOfLine: false,
          decorationClass: "slash-suggestion",
          items: ({ query }) => {
            const q = query.toLowerCase();
            if (!q) return ALL_SLASH_CMDS;
            return ALL_SLASH_CMDS.filter(
              (c) => c.label.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)
            );
          },
          command: ({ editor, range, props }) => {
            editor.chain().focus().deleteRange(range).run();
            props.run(editor);
          },
          render: () => ({
            onStart: (props) => {
              slashPropsRef.current = props;
              setSlashMenu({
                items: props.items,
                activeIndex: 0,
                rect: props.clientRect?.() ?? new DOMRect(),
              });
            },
            onUpdate: (props) => {
              slashPropsRef.current = props;
              setSlashMenu((prev) =>
                prev
                  ? { items: props.items, activeIndex: 0, rect: props.clientRect?.() ?? prev.rect }
                  : null
              );
            },
            onExit: () => {
              slashPropsRef.current = null;
              setSlashMenu(null);
            },
            onKeyDown: ({ event }) => {
              const menu = slashMenuRef.current;
              if (!menu) return false;
              if (event.key === "Escape") { setSlashMenu(null); return true; }
              if (event.key === "ArrowDown") {
                setSlashMenu((prev) =>
                  prev ? { ...prev, activeIndex: (prev.activeIndex + 1) % prev.items.length } : null
                );
                return true;
              }
              if (event.key === "ArrowUp") {
                setSlashMenu((prev) =>
                  prev ? { ...prev, activeIndex: (prev.activeIndex - 1 + prev.items.length) % prev.items.length } : null
                );
                return true;
              }
              if (event.key === "Enter") {
                const item = menu.items[menu.activeIndex];
                if (item) slashPropsRef.current?.command(item);
                return true;
              }
              return false;
            },
          }),
        }),
      ];
    },
  });
}
