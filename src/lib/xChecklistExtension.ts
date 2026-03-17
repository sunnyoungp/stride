"use client";

import { Extension } from "@tiptap/core";
import { InputRule } from "@tiptap/core";

export const XChecklistExtension = Extension.create({
  name: "xChecklistExtension",

  addInputRules() {
    const triggerRule = (find: RegExp) =>
      new InputRule({
        find,
        handler: ({ state, range, chain }) => {
          // Only trigger at very start of the textblock.
          const { from } = range;
          const $from = state.doc.resolve(from);
          const blockStart = $from.start($from.depth);
          if (range.from !== blockStart) return;

          chain().focus().deleteRange(range).toggleTaskList().run();
        },
      });

    return [
      triggerRule(/^([xX])\s$/),   // x  or X  → checklist
      triggerRule(/^\[\]\s$/),      // [] → checklist
    ];
  },
});

