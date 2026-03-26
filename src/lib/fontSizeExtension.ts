import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { TextStyle } from "@tiptap/extension-text-style";

// ── Constants ──────────────────────────────────────────────────────────────────

export const FONT_SIZE_MIN = 10;
export const FONT_SIZE_MAX = 36;
export const FONT_SIZE_STEP = 2;
export const FONT_SIZE_DEFAULT = 15; // matches --font-size-notes

// ── FontSizeTextStyle ──────────────────────────────────────────────────────────
// Extends TextStyle mark to carry a numeric fontSize attribute rendered as
// inline style="font-size: Npx" on the resulting <span>.

export const FontSizeTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (el) => {
          const val = (el as HTMLElement).style.fontSize;
          if (!val) return null;
          const n = parseInt(val, 10);
          return isNaN(n) ? null : String(n);
        },
        renderHTML: (attrs) => {
          if (!attrs.fontSize) return {};
          return { style: `font-size: ${attrs.fontSize}px` };
        },
      },
    };
  },
});

// ── getCurrentFontSize ─────────────────────────────────────────────────────────
// Reads the font size at the current cursor position (or stored mark).

export function getCurrentFontSize(editor: Editor): number {
  const attrs = editor.getAttributes("textStyle");
  if (attrs.fontSize) {
    const n = parseInt(String(attrs.fontSize), 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return FONT_SIZE_DEFAULT;
}

// ── FontSizeKeyboardExtension ──────────────────────────────────────────────────
// Intercepts Cmd+= (increase), Cmd+- (decrease), Cmd+0 (reset).
// Works on selection or as stored mark for next typed characters.

export const FontSizeKeyboardExtension = Extension.create({
  name: "fontSizeKeyboard",

  addKeyboardShortcuts() {
    return {
      "Mod-=": () => {
        const cur = getCurrentFontSize(this.editor);
        const next = Math.min(FONT_SIZE_MAX, cur + FONT_SIZE_STEP);
        this.editor.chain().focus().setMark("textStyle", { fontSize: String(next) }).run();
        return true;
      },
      "Mod--": () => {
        const cur = getCurrentFontSize(this.editor);
        const next = Math.max(FONT_SIZE_MIN, cur - FONT_SIZE_STEP);
        this.editor.chain().focus().setMark("textStyle", { fontSize: String(next) }).run();
        return true;
      },
      "Mod-0": () => {
        this.editor.chain().focus().unsetMark("textStyle").run();
        return true;
      },
    };
  },
});
