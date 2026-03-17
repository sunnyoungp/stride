"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import type { JSONContent } from "@tiptap/core";
import { useEffect, useMemo, useRef, useState } from "react";

import { DragHandleExtension } from "@/lib/dragHandleExtension";
import { XChecklistExtension } from "@/lib/xChecklistExtension";
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

function extractText(node: any): string {
  if (!node || typeof node !== "object") return "";
  if (node.type === "text" && typeof node.text === "string") return node.text;
  const content = node.content;
  if (!Array.isArray(content)) return "";
  return content.map(extractText).join("");
}


function formatUpdatedAt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
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

  const saveTimerRef = useRef<number | null>(null);
  const seenTitlesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void loadDocuments();
    void loadTasks();
  }, [loadDocuments, loadTasks]);

  useEffect(() => {
    const next = documents.find((d) => d.id === documentId) ?? null;
    setDoc(next);
  }, [documents, documentId]);

  const syncedBadge = Boolean(doc?.linkedTaskIds && doc.linkedTaskIds.length > 0);

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        TaskList,
        CustomTaskItem.configure({ nested: true }),
        XChecklistExtension,
        DragHandleExtension,
      ],
      immediatelyRender: false,
      content: doc?.content ? safeParseJson(doc.content) ?? undefined : undefined,
      editorProps: {
        attributes: {
          class: "min-h-[360px] outline-none leading-7 text-[var(--fg)]",
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

  if (!doc) {
    return (
      <div className="flex h-full w-full items-center justify-center py-16 text-sm text-zinc-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <input
            value={doc.title}
            onChange={(e) => void updateDocument(doc.id, { title: e.target.value })}
            className="w-full bg-transparent text-3xl font-bold tracking-tight text-zinc-100 outline-none placeholder:text-zinc-600"
            placeholder="Untitled"
          />
          <div className="mt-1 text-xs text-zinc-500">
            Updated {formatUpdatedAt(doc.updatedAt)}
          </div>
        </div>

        {syncedBadge ? (
          <div className="mt-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Synced to Tasks
          </div>
        ) : null}
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-zinc-900/30 p-4">
        {editor ? <EditorContent editor={editor} /> : null}
      </div>
    </div>
  );
}

