"use client";

interface PdfNativeTextFormatBarProps {
  color: string;
  fontSize: number;
  fontBold: boolean;
  fontItalic: boolean;
  onColorChange: (color: string) => void;
  onFontSizeChange: (fontSize: number) => void;
  onFontBoldChange: (fontBold: boolean) => void;
  onFontItalicChange: (fontItalic: boolean) => void;
}

export function PdfNativeTextFormatBar({
  color,
  fontSize,
  fontBold,
  fontItalic,
  onColorChange,
  onFontSizeChange,
  onFontBoldChange,
  onFontItalicChange,
}: PdfNativeTextFormatBarProps) {
  return (
    <div
      className="flex w-max items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 shadow-md"
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <label className="flex items-center gap-1 text-[11px] text-zinc-500">
        <input
          id="pdf-native-text-color"
          name="pdf-native-text-color"
          type="color"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          className="h-6 w-7 cursor-pointer rounded border border-zinc-200 p-0"
          aria-label="Text color"
        />
      </label>
      <label className="flex items-center gap-1 text-[11px] text-zinc-500">
        <input
          id="pdf-native-text-font-size"
          name="pdf-native-text-font-size"
          type="number"
          min={6}
          max={96}
          value={Math.round(fontSize)}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next) && next >= 6 && next <= 96) {
              onFontSizeChange(next);
            }
          }}
          className="w-12 rounded border border-zinc-200 px-1 py-0.5 text-xs"
          aria-label="Font size"
        />
      </label>
      <button
        type="button"
        aria-label="Bold"
        aria-pressed={fontBold}
        onClick={() => onFontBoldChange(!fontBold)}
        className={`rounded px-1.5 py-0.5 text-xs font-bold ${
          fontBold
            ? "bg-indigo-600 text-white"
            : "text-zinc-700 hover:bg-zinc-100"
        }`}
      >
        B
      </button>
      <button
        type="button"
        aria-label="Italic"
        aria-pressed={fontItalic}
        onClick={() => onFontItalicChange(!fontItalic)}
        className={`rounded px-1.5 py-0.5 text-xs italic ${
          fontItalic
            ? "bg-indigo-600 text-white"
            : "text-zinc-700 hover:bg-zinc-100"
        }`}
      >
        I
      </button>
    </div>
  );
}
