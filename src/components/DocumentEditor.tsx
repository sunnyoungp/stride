"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import type { JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "prosemirror-model";
import type { SuggestionProps } from "@tiptap/suggestion";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import { XChecklistExtension } from "@/lib/xChecklistExtension";
import { FontSizeTextStyle, FontSizeKeyboardExtension, ParagraphWithLineHeight, getCurrentFontSize, FONT_SIZE_DEFAULT } from "@/lib/fontSizeExtension";
import { type SlashCmd, type SlashMenuState, createSlashCommandExtension } from "@/lib/slashCommands";
import { SlashCommandMenu } from "@/components/SlashCommandMenu";
import { EditorBubbleMenu } from "@/components/EditorBubbleMenu";
import { FormatPanel } from "@/components/FormatPanel";
import Color from "@tiptap/extension-color";
import TiptapLink from "@tiptap/extension-link";
import Link from "next/link";
import { TextStyle } from "@tiptap/extension-text-style";
import { useDocumentStore } from "@/store/documentStore";
import { useTaskStore } from "@/store/taskStore";
import type { StrideDocument, Task } from "@/types/index";

const CustomTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      taskId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-task-id"),
        renderHTML: (attributes) => ({
          "data-task-id": attributes.taskId,
        }),
      },
    };
  },
});

type Props = {
  documentId: string;
};


function safeParseJson(value: string): JSONContent | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as JSONContent;
  } catch {
    return null;
  }
}


function formatUpdatedAt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function uniq(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) if (id && !out.includes(id)) out.push(id);
  return out;
}

export function DocumentEditor({ documentId }: Props) {
  const documents = useDocumentStore((s) => s.documents);
  const loadDocuments = useDocumentStore((s) => s.loadDocuments);
  const updateDocument = useDocumentStore((s) => s.updateDocument);

  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const createTask = useTaskStore((s) => s.createTask);
  const updateTask = useTaskStore((s) => s.updateTask);

  const docInState = documents.find((d) => d.id === documentId) ?? null;
  const [doc, setDoc] = useState<StrideDocument | null>(docInState);

  // Local title state — decoupled from the store so keystrokes are instant
  const [localTitle, setLocalTitle] = useState(docInState?.title ?? "");
  const titleSaveTimerRef = useRef<number | null>(null);
  // Track the doc ID we last synced the title from, so we only overwrite localTitle
  // when the document itself changes (navigation), not on every store update.
  const lastSyncedDocIdRef = useRef<string | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const seenTitlesRef = useRef<Set<string>>(new Set());

  // Slash command state
  const [slashMenu, setSlashMenu] = useState<SlashMenuState>(null);
  const slashMenuRef = useRef<SlashMenuState>(null);
  const slashPropsRef = useRef<SuggestionProps<SlashCmd, SlashCmd> | null>(null);
  useEffect(() => { slashMenuRef.current = slashMenu; }, [slashMenu]);

  useEffect(() => {
    void loadDocuments();
    void loadTasks();
  }, [loadDocuments, loadTasks]);

  useEffect(() => {
    const next = documents.find((d) => d.id === documentId) ?? null;
    setDoc(next);
    // Only reset localTitle when navigating to a different document
    if (next && next.id !== lastSyncedDocIdRef.current) {
      setLocalTitle(next.title ?? "");
      lastSyncedDocIdRef.current = next.id;
    }
  }, [documents, documentId]);

  const [formatPanelOpen, setFormatPanelOpen] = useState(false);
  const toggleFormatPanel = () => {
    setFormatPanelOpen(prev => !prev);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFormatPanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Flush any pending title save on unmount
  useEffect(() => {
    return () => {
      if (titleSaveTimerRef.current) window.clearTimeout(titleSaveTimerRef.current);
    };
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalTitle(value);
    if (titleSaveTimerRef.current) window.clearTimeout(titleSaveTimerRef.current);
    titleSaveTimerRef.current = window.setTimeout(() => {
      if (doc) void updateDocument(doc.id, { title: value });
    }, 600);
  };

  const handleTitleBlur = () => {
    if (titleSaveTimerRef.current) window.clearTimeout(titleSaveTimerRef.current);
    if (doc) void updateDocument(doc.id, { title: localTitle });
  };

  const syncedBadge = Boolean(doc?.linkedTaskIds && doc.linkedTaskIds.length > 0);



  // eslint-disable-next-line react-hooks/exhaustive-deps
  const slashCommandExtension = useMemo(() => createSlashCommandExtension(slashPropsRef, slashMenuRef, setSlashMenu), []);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ paragraph: false }),
        ParagraphWithLineHeight,
        TaskList,
        CustomTaskItem.configure({ nested: true }),
        XChecklistExtension,
        slashCommandExtension,
        TextStyle,
        Color,
        TiptapLink.configure({ openOnClick: false }),
        FontSizeTextStyle,
        FontSizeKeyboardExtension,
      ],
      immediatelyRender: false,
      editable: true, // Always editable
      content: doc?.content ? safeParseJson(doc.content) ?? undefined : undefined,
      editorProps: {
        attributes: {
          class: "min-h-[360px] outline-none  text-[var(--fg)]",
        },
      },
      onUpdate: ({ editor }) => {
        if (!doc) return;

        const json = editor.getJSON();
        const content = JSON.stringify(json);

        // Only update content via this debounced timer
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
          void updateDocument(doc.id, { content });
        }, 1000);

        // Sync logic: Handle task creation and status sync FROM editor TO store
        editor.state.doc.descendants((node, pos) => {
          if (isSyncingRef.current) return;
          if (node.type.name === "taskItem") {
            const taskId = node.attrs.taskId;
            const checked = node.attrs.checked;
            const title = node.textContent.trim();

            if (taskId) {
              const task = tasks.find((t) => t.id === taskId);
              if (task) {
                const statusChanged = (task.status === "done") !== checked;
                const titleChanged = task.title !== title;
                if (statusChanged || titleChanged) {
                  // Only update the task store, do NOT call updateDocument({content}) here
                  void updateTask(taskId, {
                    status: checked ? "done" : "todo",
                    title,
                  });
                }
              }
            } else if (title.length >= 3) {
              const debounceKey = `pending-${pos}`;
              if (seenTitlesRef.current.has(debounceKey)) return;
              seenTitlesRef.current.add(debounceKey);

              setTimeout(() => {
                const latestNode = editor.state.doc.nodeAt(pos);
                if (!latestNode || latestNode.textContent.trim().length < 3) {
                  seenTitlesRef.current.delete(debounceKey);
                  return;
                }

                void (async () => {
                  const created = await createTask({
                    title: latestNode.textContent.trim(),
                    sourceDocumentId: doc.id,
                    sourceDocumentTitle: doc.title,
                    status: latestNode.attrs.checked ? "done" : "todo",
                  });

                  // Update linkedTaskIds EXCLUSIVELY - do not include content field
                  const currentDoc = useDocumentStore.getState().documents.find(d => d.id === doc.id);
                  const nextLinked = uniq([...(currentDoc?.linkedTaskIds ?? []), created.id]);
                  void updateDocument(doc.id, { linkedTaskIds: nextLinked });

                  // Update editor node attributes without triggering a recursive onUpdate loop
                  editor.commands.command(({ tr }) => {
                    tr.setNodeMarkup(pos, undefined, {
                      ...latestNode.attrs,
                      taskId: created.id,
                    });
                    return true;
                  });
                })();
              }, 1500);
            }
          }
        });
      },
    },
    [doc?.id],
  );



  useEffect(() => {
    if (!editor || !doc) return;
    const nextJson = doc.content ? safeParseJson(doc.content) : null;
    if (nextJson) editor.commands.setContent(nextJson, { emitUpdate: false });

    const existingTitles = tasks
      .filter((t) => t.sourceDocumentId === doc.id)
      .map((t) => t.title.trim())
      .filter(Boolean);
    seenTitlesRef.current = new Set(existingTitles);
  }, [editor, doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync FROM Task Store TO Editor (e.g. if task is checked/renamed in Tasks Tab)
  const isSyncingRef = useRef(false);
  useEffect(() => {
    if (!editor || !doc || isSyncingRef.current) return;

    let changed = false;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "taskItem") {
        const taskId = node.attrs.taskId;
        if (!taskId) return;

        const task = tasks.find((t) => t.id === taskId);
        if (task) {
          const isDone = task.status === "done";
          const title = node.textContent.trim();
          const titleMatches = title === task.title;

          if (node.attrs.checked !== isDone || !titleMatches) {
            isSyncingRef.current = true;
            changed = true;
            editor.commands.command(({ tr }) => {
              // Update status
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                checked: isDone,
              });

              // Update title if needed
              if (!titleMatches) {
                const innerPos = pos + 1;
                tr.insertText(task.title, innerPos, innerPos + node.nodeSize - 2);
              }
              return true;
            });
          }
        } else {
          // Task was deleted from store - remove the attribute so it doesn't keep trying to sync
          isSyncingRef.current = true;
          changed = true;
          editor.commands.command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              taskId: null,
            });
            return true;
          });
        }
      }
    });

    if (changed) {
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 100);
    }
  }, [tasks, editor, doc?.id]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const [editorFontSize, setEditorFontSize] = useState(FONT_SIZE_DEFAULT);
  useEffect(() => {
    if (!editor) return;
    const update = () => setEditorFontSize(getCurrentFontSize(editor));
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  if (!doc) {
    return (
      <div className="flex h-full w-full items-center justify-center py-16 text-sm" style={{ color: "var(--fg-muted)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[680px] px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex-1 flex flex-col gap-2">
          {/* Mobile Back Button */}
          <Link
            href="/documents"
            className="md:hidden flex items-center gap-1.5 text-xs font-medium mb-1"
            style={{ color: "var(--fg-faint)" }}
          >
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
              <path d="M9 4l-4 3.5L9 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Documents
          </Link>

          <input
            value={localTitle}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            className="w-full bg-transparent font-bold outline-none"
            style={{ color: "var(--fg)", fontSize: 30, lineHeight: 1.2 }}
            placeholder="Untitled"
          />
          <div className="mt-1 text-xs" style={{ color: "var(--fg-faint)" }}>
            Updated {formatUpdatedAt(doc.updatedAt)}
          </div>
        </div>

        <div className="flex items-center gap-2">

          {syncedBadge ? (
            <div className="mt-1 rounded-lg px-3 py-1 text-xs font-medium flex-shrink-0 hidden md:block" style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--border)" }}>
              Synced
            </div>
          ) : null}
          <button
            type="button"
            data-format-trigger
            onClick={toggleFormatPanel}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors border"
            style={{
              background: formatPanelOpen ? "var(--bg-active)" : "var(--bg-subtle)",
              borderColor: formatPanelOpen ? "var(--accent)" : "var(--border)",
              color: formatPanelOpen ? "var(--accent)" : "var(--fg-muted)",
              marginTop: "4px"
            }}
            title="Format Panel (Cmd+Shift+F)"
          >
            <span className="text-[14px] font-bold font-serif leading-none">Aa</span>
          </button>
        </div>
      </div>

      {/* Shortcuts hint bar — hide on mobile */}
      <div className="mb-4 hidden md:flex items-center gap-3">
        <span
          title="Font size — use Cmd+= / Cmd+- to adjust, Cmd+0 to reset"
          style={{ fontSize: 11, color: "var(--fg-faint)", userSelect: "none", fontVariantNumeric: "tabular-nums" }}
        >
          {editorFontSize}px
        </span>
        <span style={{ fontSize: 11, color: "var(--fg-faint)", userSelect: "none" }}>
          Cmd+= / Cmd+- to resize · Cmd+0 to reset · Type / for commands
        </span>
      </div>

      {/* Editor — full-bleed, no card wrapper */}
      {editor ? (
        <>
          <EditorContent editor={editor} />
          <EditorBubbleMenu editor={editor} />
          <FormatPanel editor={editor} isOpen={formatPanelOpen} onClose={() => setFormatPanelOpen(false)} documentId={doc.id} />
        </>
      ) : null}

      {/* Slash command menu */}
      {slashMenu && slashMenu.items.length > 0 && createPortal(
        <SlashCommandMenu
          items={slashMenu.items}
          activeIndex={slashMenu.activeIndex}
          rect={slashMenu.rect}
          onSelect={(cmd) => {
            slashPropsRef.current?.command(cmd);
            setSlashMenu(null);
          }}
          onClose={() => setSlashMenu(null)}
        />,
        document.body,
      )}
    </div>
  );
}
