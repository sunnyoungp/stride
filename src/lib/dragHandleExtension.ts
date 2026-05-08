import { Extension } from "@tiptap/core";
import { Plugin, NodeSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

// ─── Drag handle plugin (mouse-event based for Tauri/WKWebView compat) ───────

function createDragHandlePlugin() {
  let handle: HTMLElement | null = null;
  let currentTopPos = -1;

  // Mouse-drag state
  let dragActive = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragNodePos = -1;
  let preview: HTMLElement | null = null;
  let dropIndicator: HTMLElement | null = null;
  let activeView: EditorView | null = null;

  function cleanupDrag() {
    dragActive = false;
    dragNodePos = -1;
    activeView = null;
    if (preview) { preview.remove(); preview = null; }
    if (dropIndicator) { dropIndicator.remove(); dropIndicator = null; }
    // Clear calendar highlight
    document.querySelectorAll("[data-calendar-date]").forEach((el) => {
      (el as HTMLElement).style.outline = "";
    });
  }

  return new Plugin({
    view(view: EditorView) {
      handle = document.createElement("div");
      handle.className = "pm-drag-handle";
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

      handle.innerHTML =
        '<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">' +
        '<circle cx="3" cy="2.5" r="1.2"/><circle cx="7" cy="2.5" r="1.2"/>' +
        '<circle cx="3" cy="7"   r="1.2"/><circle cx="7" cy="7"   r="1.2"/>' +
        '<circle cx="3" cy="11.5" r="1.2"/><circle cx="7" cy="11.5" r="1.2"/>' +
        "</svg>";

      handle.addEventListener("mouseenter", () => {
        if (!handle || dragActive) return;
        handle.style.opacity = "1";
        handle.style.background = "var(--bg-hover)";
      });
      handle.addEventListener("mouseleave", () => {
        if (!handle || dragActive) return;
        handle.style.opacity = "0.4";
        handle.style.background = "transparent";
      });

      // ── Mouse-event drag: mousedown on handle starts tracking ──
      handle.addEventListener("mousedown", (e) => {
        if (currentTopPos < 0 || e.button !== 0) return;
        e.preventDefault();

        try {
          const sel = NodeSelection.create(view.state.doc, currentTopPos);
          view.dispatch(view.state.tr.setSelection(sel));
          view.focus();
        } catch { /* ignore */ }

        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragNodePos = currentTopPos;
        activeView = view;
      });

      const onMouseMove = (e: MouseEvent) => {
        if (dragNodePos < 0 || !activeView) return;

        if (!dragActive) {
          if (Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) < 5) return;
          dragActive = true;
          if (handle) {
            handle.style.opacity = "0";
            handle.style.cursor = "grabbing";
          }

          // Create floating preview from the dragged block's DOM
          const dom = activeView.nodeDOM(dragNodePos) as HTMLElement | null;
          preview = document.createElement("div");
          preview.style.cssText =
            "position:fixed;pointer-events:none;z-index:9999;opacity:0.85;" +
            "background:var(--bg-card);border:1px solid var(--glass-border);" +
            "box-shadow:var(--shadow-float);border-radius:8px;padding:6px 12px;" +
            "font-size:13px;color:var(--fg);max-width:320px;overflow:hidden;" +
            "white-space:nowrap;text-overflow:ellipsis;";
          preview.textContent = dom?.textContent?.trim().slice(0, 60) || "Block";
          document.body.appendChild(preview);

          // Create drop indicator line
          dropIndicator = document.createElement("div");
          dropIndicator.style.cssText =
            "position:fixed;pointer-events:none;z-index:9998;height:2px;" +
            "background:var(--accent);border-radius:1px;display:none;";
          document.body.appendChild(dropIndicator);
        }

        // Position preview
        if (preview) {
          preview.style.left = `${e.clientX + 14}px`;
          preview.style.top = `${e.clientY - 14}px`;
        }

        // Hide preview temporarily for hit testing
        if (preview) preview.style.display = "none";
        if (dropIndicator) dropIndicator.style.display = "none";
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (preview) preview.style.display = "";

        // Check calendar cell
        const calCell = el?.closest("[data-calendar-date]") as HTMLElement | null;
        document.querySelectorAll("[data-calendar-date]").forEach((c) => {
          (c as HTMLElement).style.outline = "";
        });
        if (calCell) {
          calCell.style.outline = "2px solid var(--accent)";
          if (dropIndicator) dropIndicator.style.display = "none";
          return;
        }

        // Check if over the editor — show drop indicator between blocks
        const editorDom = el?.closest(".ProseMirror") as HTMLElement | null;
        if (editorDom && dropIndicator) {
          const pos = activeView.posAtCoords({ left: e.clientX, top: e.clientY });
          if (pos) {
            try {
              const $pos = activeView.state.doc.resolve(pos.pos);
              // Find the nearest block boundary
              let blockPos = -1;
              for (let d = $pos.depth; d >= 1; d--) {
                const name = $pos.node(d).type.name;
                if (name === "taskItem" || name === "listItem") {
                  blockPos = $pos.before(d);
                  break;
                }
              }
              if (blockPos < 0 && $pos.depth >= 1) {
                blockPos = $pos.before(1);
              }
              if (blockPos >= 0) {
                const blockDom = activeView.nodeDOM(blockPos) as HTMLElement | null;
                if (blockDom) {
                  const rect = blockDom.getBoundingClientRect();
                  const editorRect = editorDom.getBoundingClientRect();
                  // Determine if cursor is in top or bottom half
                  const midY = rect.top + rect.height / 2;
                  const indicatorY = e.clientY < midY ? rect.top : rect.bottom;
                  dropIndicator.style.display = "";
                  dropIndicator.style.left = `${editorRect.left + 8}px`;
                  dropIndicator.style.width = `${editorRect.width - 16}px`;
                  dropIndicator.style.top = `${indicatorY}px`;
                }
              }
            } catch {
              dropIndicator.style.display = "none";
            }
          }
        } else if (dropIndicator) {
          dropIndicator.style.display = "none";
        }
      };

      const onMouseUp = (e: MouseEvent) => {
        if (!dragActive || dragNodePos < 0 || !activeView) {
          cleanupDrag();
          if (handle) handle.style.cursor = "grab";
          return;
        }

        const v = activeView;
        const sourcePos = dragNodePos;

        // Hide preview for hit testing
        if (preview) preview.style.display = "none";
        if (dropIndicator) dropIndicator.style.display = "none";
        const el = document.elementFromPoint(e.clientX, e.clientY);

        // ── Drop on calendar cell ──
        const calCell = el?.closest("[data-calendar-date]") as HTMLElement | null;
        const targetDate = calCell?.getAttribute("data-calendar-date");
        if (targetDate) {
          // Dispatch a custom event that DailyNote can listen for
          const node = v.state.doc.nodeAt(sourcePos);
          if (node) {
            const isListWrapper = ["taskList", "bulletList", "orderedList"].includes(node.type.name);
            const contentNode = isListWrapper ? node.firstChild : node;
            const title = node.textContent?.trim() ?? "";
            const isTask = node.type.name === "taskItem" || (isListWrapper && contentNode?.type.name === "taskItem");
            const taskId = isTask && contentNode ? ((contentNode.attrs as Record<string, unknown>).taskId as string ?? null) : null;
            const json = (contentNode ?? node).toJSON();

            window.dispatchEvent(new CustomEvent("stride-block-drop-calendar", {
              detail: { title, taskId, date: targetDate, json },
            }));
          }
          cleanupDrag();
          if (handle) handle.style.cursor = "grab";
          return;
        }

        // ── Drop within editor — move node via ProseMirror transaction ──
        const editorDom = el?.closest(".ProseMirror") as HTMLElement | null;
        if (editorDom) {
          const dropCoords = v.posAtCoords({ left: e.clientX, top: e.clientY });
          if (dropCoords) {
            try {
              const $drop = v.state.doc.resolve(dropCoords.pos);
              // Find drop block boundary
              let dropBlockPos = -1;
              for (let d = $drop.depth; d >= 1; d--) {
                const name = $drop.node(d).type.name;
                if (name === "taskItem" || name === "listItem") {
                  dropBlockPos = $drop.before(d);
                  break;
                }
              }
              if (dropBlockPos < 0 && $drop.depth >= 1) {
                dropBlockPos = $drop.before(1);
              }

              if (dropBlockPos >= 0 && dropBlockPos !== sourcePos) {
                const node = v.state.doc.nodeAt(sourcePos);
                if (node) {
                  const dropDom = v.nodeDOM(dropBlockPos) as HTMLElement | null;
                  const rect = dropDom?.getBoundingClientRect();
                  const insertAfter = rect ? e.clientY > rect.top + rect.height / 2 : true;

                  // Calculate target position
                  const dropNode = v.state.doc.nodeAt(dropBlockPos);
                  let targetPos = insertAfter ? dropBlockPos + (dropNode?.nodeSize ?? 1) : dropBlockPos;

                  // Execute move: delete source, then insert at adjusted position
                  const tr = v.state.tr;
                  const nodeSlice = node.copy(node.content);
                  const nodeSize = node.nodeSize;

                  // If source is before target, deleting source shifts target position
                  if (sourcePos < targetPos) {
                    tr.delete(sourcePos, sourcePos + nodeSize);
                    targetPos -= nodeSize;
                  } else {
                    tr.delete(sourcePos, sourcePos + nodeSize);
                  }
                  tr.insert(targetPos, nodeSlice);
                  v.dispatch(tr);
                }
              }
            } catch { /* ignore failed move */ }
          }
        }

        cleanupDrag();
        if (handle) handle.style.cursor = "grab";
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);

      document.body.appendChild(handle);

      return {
        destroy() {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
          cleanupDrag();
          handle?.remove();
          handle = null;
        },
      };
    },

    props: {
      handleDOMEvents: {
        mousemove(view, event) {
          if (!handle || dragActive) return false;

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

            let topPos = -1;
            for (let d = $pos.depth; d >= 1; d--) {
              const name = $pos.node(d).type.name;
              if (name === "taskItem" || name === "listItem") {
                topPos = $pos.before(d);
                break;
              }
            }

            if (topPos < 0) {
              for (let d = Math.min($pos.depth, 10); d >= 1; d--) {
                try {
                  const candidate = $pos.before(d);
                  if (view.state.doc.resolve(candidate).depth === 0) {
                    topPos = candidate;
                    break;
                  }
                } catch { continue; }
              }
            }

            if (topPos < 0) {
              handle.style.opacity = "0";
              return false;
            }

            const nodeDom = view.nodeDOM(topPos) as HTMLElement | null;
            if (!nodeDom) {
              handle.style.opacity = "0";
              return false;
            }

            const nodeRect = nodeDom.getBoundingClientRect();
            const handleH = 24;
            handle.style.top = `${nodeRect.top + (nodeRect.height - handleH) / 2}px`;
            handle.style.left = `${nodeRect.left - 18}px`;
            handle.style.opacity = "0.4";
            currentTopPos = topPos;
          } catch {
            handle.style.opacity = "0";
          }

          return false;
        },

        mouseleave(_view, event) {
          if (dragActive) return false;
          const related = (event as MouseEvent).relatedTarget as Node | null;
          if (related && handle?.contains(related)) return false;
          const h = handle;
          if (h) {
            setTimeout(() => {
              if (h.matches(":hover")) return;
              h.style.opacity = "0";
            }, 150);
          }
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
