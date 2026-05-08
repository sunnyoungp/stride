import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Toggle block — a collapsible section with a summary line and hidden content.
 * Renders as <details><summary>…</summary><div>…</div></details>.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    toggle: {
      setToggle: () => ReturnType;
    };
  }
}

export const ToggleNode = Node.create({
  name: "toggle",
  group: "block",
  content: "toggleSummary toggleContent",
  defining: true,

  parseHTML() {
    return [{ tag: "details" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["details", mergeAttributes(HTMLAttributes, { class: "stride-toggle" }), 0];
  },

  addCommands() {
    return {
      setToggle:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: "toggle",
            content: [
              {
                type: "toggleSummary",
                content: [{ type: "text", text: "Toggle" }],
              },
              {
                type: "toggleContent",
                content: [{ type: "paragraph" }],
              },
            ],
          });
        },
    };
  },
});

export const ToggleSummary = Node.create({
  name: "toggleSummary",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "summary" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["summary", mergeAttributes(HTMLAttributes, { class: "stride-toggle-summary" }), 0];
  },
});

export const ToggleContent = Node.create({
  name: "toggleContent",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-toggle-content]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-toggle-content": "", class: "stride-toggle-content" }), 0];
  },
});
