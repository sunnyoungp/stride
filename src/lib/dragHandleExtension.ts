import { Extension } from "@tiptap/core";
import { Plugin, NodeSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

// ─── Drag handle plugin ────────────────────────────────────────────────────────

function createDragHandlePlugin() {
  let handle: HTMLElement | null = null;
  let currentTopPos = -1;

  return new Plugin({
    view(view: EditorView) {
      // Build the handle element
      handle = document.createElement("div");
      handle.className = "pm-drag-handle";
      handle.draggable = true;
      handle.contentEditable = "false";
      handle.setAttribute("aria-hidden", "true");
      handle.style.cssText = [
        "position:fixed",
        "top:0",
        "left:0",
        "width:16px",
        "height:24px",
        "opacity:0",
        "cursor:grab",
        "border-radius:4px",
        "color:var(--fg-muted)",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "transition:opacity 100ms ease,background 100ms ease",
        "user-select:none",
        "z-index:9999",
        "pointer-events:auto",
      ].join(";");

      // Six-dot grid icon
      handle.innerHTML =
        '<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">' +
        '<circle cx="3" cy="2.5" r="1.2"/><circle cx="7" cy="2.5" r="1.2"/>' +
        '<circle cx="3" cy="7"   r="1.2"/><circle cx="7" cy="7"   r="1.2"/>' +
        '<circle cx="3" cy="11.5" r="1.2"/><circle cx="7" cy="11.5" r="1.2"/>' +
        "</svg>";

      handle.addEventListener("mouseenter", () => {
        if (!handle) return;
        handle.style.opacity = "1";
        handle.style.background = "var(--bg-hover)";
      });
      handle.addEventListener("mouseleave", () => {
        if (!handle) return;
        handle.style.opacity = "0.4";
        handle.style.background = "transparent";
      });

      // Select the block on mousedown so ProseMirror knows what to drag
      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (currentTopPos < 0) return;
        try {
          const sel = NodeSelection.create(view.state.doc, currentTopPos);
          view.dispatch(view.state.tr.setSelection(sel));
          view.focus();
        } catch {
          // pos might be invalid; ignore
        }
      });

      // On dragstart, hand the current selection slice to ProseMirror
      handle.addEventListener("dragstart", (e) => {
        if (currentTopPos < 0 || !e.dataTransfer) return;
        try {
          const slice = view.state.selection.content();
          e.dataTransfer.effectAllowed = "move";
          // Use the node's DOM as the drag image
          const dom = view.nodeDOM(currentTopPos) as HTMLElement | null;
          if (dom) e.dataTransfer.setDragImage(dom, 0, 0);
          // ProseMirror reads this on drop to know what was dragged
          (view as unknown as Record<string, unknown>).dragging = { slice, move: true };

          // Attach block-type-aware drag data for external drop targets
          try {
            const node = view.state.doc.nodeAt(currentTopPos);
            if (node) {
              // For list wrappers (taskList, bulletList, orderedList), drill into first child
              const isListWrapper = ["taskList", "bulletList", "orderedList"].includes(node.type.name);
              const contentNode   = isListWrapper ? node.firstChild : node;
              const title         = node.textContent?.trim() ?? "";
              const isTask        = node.type.name === "taskItem" ||
                                    (isListWrapper && contentNode?.type.name === "taskItem");
              const taskId        = isTask && contentNode
                ? ((contentNode.attrs as Record<string, unknown>).taskId as string ?? "")
                : "";
              if (title) {
                e.dataTransfer.setData("text/block-type",  isTask ? "task" : "note");
                e.dataTransfer.setData("text/task-title",  title);
                e.dataTransfer.setData("stride/taskTitle", title);
                e.dataTransfer.setData("text/plain",       title);
                if (taskId) {
                  e.dataTransfer.setData("text/task-id",   taskId);
                  e.dataTransfer.setData("stride/taskId",  taskId);
                }
              }
            }
          } catch { /* ignore */ }
        } catch {
          // ignore
        }
      });

      handle.addEventListener("dragend", () => {
        (view as unknown as Record<string, unknown>).dragging = null;
        if (handle) handle.style.opacity = "0";
      });

      // Attach to document.body so fixed positioning is never clipped by overflow:hidden parents
      document.body.appendChild(handle);

      return {
        destroy() {
          handle?.remove();
          handle = null;
        },
      };
    },

    props: {
      handleDOMEvents: {
        mousemove(view, event) {
          if (!handle) return false;

          // Hide if cursor left the editor
          if (!view.dom.contains(event.target as Node)) {
            handle.style.opacity = "0";
            return false;
          }

          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (!pos) {
            handle.style.opacity = "0";
            return false;
          }

          try {
            const $pos = view.state.doc.resolve(pos.pos);
            if ($pos.depth < 1) {
              handle.style.opacity = "0";
              return false;
            }

            const topPos  = $pos.before(1);
            const nodeDom = view.nodeDOM(topPos) as HTMLElement | null;
            if (!nodeDom) {
              handle.style.opacity = "0";
              return false;
            }

            // Use viewport coords for fixed positioning
            const nodeRect   = nodeDom.getBoundingClientRect();
            const editorRect = view.dom.getBoundingClientRect();
            const handleH    = 24;
            handle.style.top  = `${nodeRect.top + (nodeRect.height - handleH) / 2}px`;
            handle.style.left = `${editorRect.left - 28}px`;
            handle.style.opacity = "0.4";
            currentTopPos = topPos;
          } catch {
            handle.style.opacity = "0";
          }

          return false;
        },

        mouseleave(_view, event) {
          const related = (event as MouseEvent).relatedTarget as Node | null;
          // Don't hide if mouse moved onto the handle itself
          if (related && handle?.contains(related)) return false;
          if (handle) handle.style.opacity = "0";
          return false;
        },
      },
    },
  });
}

export const DragHandleExtension = Extension.create({
  name: "dragHandle",
  addProseMirrorPlugins() {
    return [createDragHandlePlugin()];
  },
});
