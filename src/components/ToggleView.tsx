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
      <div style={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        {/* Toggle arrow */}
        <button
          type="button"
          contentEditable={false}
          onClick={() => updateAttributes({ open: !isOpen })}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "1px 2px",
            marginTop: "0.2em",
            fontSize: "0.65em",
            lineHeight: 1,
            color: "var(--fg-muted)",
            transition: "transform 150ms ease",
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            flexShrink: 0,
            userSelect: "none",
          }}
        >
          ▶
        </button>

        {/* Content — first block is the "summary", rest collapse when closed */}
        <NodeViewContent
          className="stride-toggle-content"
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>
    </NodeViewWrapper>
  );
}
