"use client";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

export function ToggleView({ node, updateAttributes }: NodeViewProps) {
  const isOpen = node.attrs.open as boolean;

  return (
    <NodeViewWrapper
      data-type="toggle"
      data-open={String(isOpen)}
      style={{ margin: "0.15rem 0" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <button
          type="button"
          contentEditable={false}
          onClick={() => updateAttributes({ open: !isOpen })}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "1px 4px",
            marginTop: "0.15em",
            fontSize: "0.85em",
            lineHeight: 1,
            color: "var(--fg-muted)",
            flexShrink: 0,
            userSelect: "none",
            transition: "color 150ms ease",
          }}
        >
          {isOpen ? "▾" : "▸"}
        </button>

        <NodeViewContent
          className="stride-toggle-content"
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>
    </NodeViewWrapper>
  );
}
