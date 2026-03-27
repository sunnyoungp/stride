import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { TextStyle } from "@tiptap/extension-text-style";
import { Paragraph } from "@tiptap/extension-paragraph";

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
          const px = parseInt(String(attrs.fontSize), 10);
          const lh = isNaN(px) ? "" : `; line-height: ${(px * 1.15).toFixed(1)}px`;
          return { style: `font-size: ${attrs.fontSize}px${lh}` };
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

// ── ParagraphWithLineHeight ────────────────────────────────────────────────────
// Extends the base Paragraph node to support a lineHeight style attribute.
// Use this instead of Paragraph from StarterKit in editors that use font sizing.

export const ParagraphWithLineHeight = Paragraph.extend({
  addAttributes() {
    return {
      lineHeight: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.lineHeight || null,
        renderHTML: (attrs) => {
          if (!attrs.lineHeight) return {};
          return { style: `line-height: ${attrs.lineHeight}` };
        },
      },
    };
  },
});

// ── FontSizeKeyboardExtension ──────────────────────────────────────────────────
// Intercepts Cmd+= (increase), Cmd+- (decrease), Cmd+0 (reset).
// Sets font-size on the text mark and line-height on the containing paragraph(s)
// so both block-level spacing and inline rendering scale together.

export const FontSizeKeyboardExtension = Extension.create({
  name: "fontSizeKeyboard",

  addKeyboardShortcuts() {
    return {
      "Mod-=": () => {
        const cur = getCurrentFontSize(this.editor);
        const next = Math.min(FONT_SIZE_MAX, cur + FONT_SIZE_STEP);
        const lh = `${(next * 1.15).toFixed(1)}px`;
        this.editor.chain().focus()
          .setMark("textStyle", { fontSize: String(next) })
          .updateAttributes("paragraph", { lineHeight: lh })
          .run();
        return true;
      },
      "Mod--": () => {
        const cur = getCurrentFontSize(this.editor);
        const next = Math.max(FONT_SIZE_MIN, cur - FONT_SIZE_STEP);
        const lh = `${(next * 1.15).toFixed(1)}px`;
        this.editor.chain().focus()
          .setMark("textStyle", { fontSize: String(next) })
          .updateAttributes("paragraph", { lineHeight: lh })
          .run();
        return true;
      },
      "Mod-0": () => {
        this.editor.chain().focus()
          .unsetMark("textStyle")
          .updateAttributes("paragraph", { lineHeight: null })
          .run();
        return true;
      },
    };
  },
});
