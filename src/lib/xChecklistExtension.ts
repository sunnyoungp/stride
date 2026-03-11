"use client";

import { Extension } from "@tiptap/core";
import { InputRule } from "@tiptap/core";

export const XChecklistExtension = Extension.create({
  name: "xChecklistExtension",

  addInputRules() {
    return [
      new InputRule({
        find: /^([xX])\s$/,
        handler: ({ state, range, chain }) => {
          // Only trigger at very start of the textblock.
          const { from } = range;
          const $from = state.doc.resolve(from);
          const blockStart = $from.start($from.depth);
          if (range.from !== blockStart) return;

          chain().focus().deleteRange(range).toggleTaskList().run();
        },
      }),
    ];
  },
});

