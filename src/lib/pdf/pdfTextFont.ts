export interface PdfFontStyle {
  fontFamily: string;
  fontBold: boolean;
  fontItalic: boolean;
  ascent: number;
  descent: number;
}

const DEFAULT_FONT: PdfFontStyle = {
  fontFamily: "sans-serif",
  fontBold: false,
  fontItalic: false,
  ascent: 0.75,
  descent: 0.25,
};

export function parseFontTraits(fontName: string, fontFamily: string) {
  const combined = `${fontName} ${fontFamily}`.toLowerCase();
  const fontBold =
    /bold|black|heavy|semibold|demibold|700|800|900/.test(combined) &&
    !/semilight|demilight/.test(combined);
  const fontItalic = /italic|oblique|it/.test(combined);
  return { fontBold, fontItalic };
}

export function resolvePdfFontStyle(
  fontName: string | undefined,
  styles: Record<string, { fontFamily?: string; ascent?: number; descent?: number }>,
): PdfFontStyle {
  if (!fontName) return DEFAULT_FONT;

  const style = styles[fontName];
  const fontFamily = style?.fontFamily?.trim() || "sans-serif";
  const traits = parseFontTraits(fontName, fontFamily);

  return {
    fontFamily,
    fontBold: traits.fontBold,
    fontItalic: traits.fontItalic,
    ascent: style?.ascent ?? DEFAULT_FONT.ascent,
    descent: style?.descent ?? DEFAULT_FONT.descent,
  };
}

export function buildCanvasFontCss(
  fontSize: number,
  style: Pick<PdfFontStyle, "fontFamily" | "fontBold" | "fontItalic">,
): string {
  const weight = style.fontBold ? "bold" : "normal";
  const fontStyle = style.fontItalic ? "italic" : "normal";
  return `${fontStyle} ${weight} ${fontSize}px ${style.fontFamily}`;
}

export function textBoxMetrics(
  fontSize: number,
  style: Pick<PdfFontStyle, "ascent" | "descent">,
) {
  const height = fontSize * (style.ascent - style.descent);
  return {
    height,
    topOffset: fontSize * style.ascent,
  };
}

export function topFromBaseline(
  baselineY: number,
  fontSize: number,
  style: Pick<PdfFontStyle, "ascent">,
) {
  return baselineY - fontSize * style.ascent;
}

export type PdfLibFontKey = string;

export function pdfLibFontKey(style: PdfFontStyle): PdfLibFontKey {
  const family = style.fontFamily.toLowerCase();
  let base = "helvetica";
  if (family.includes("courier") || family.includes("mono")) base = "courier";
  else if (
    family.includes("times") ||
    (family.includes("serif") && !family.includes("sans"))
  ) {
    base = "times";
  }

  if (style.fontBold && style.fontItalic) return `${base}-bold-italic`;
  if (style.fontBold) return `${base}-bold`;
  if (style.fontItalic) return `${base}-italic`;
  return base;
}
