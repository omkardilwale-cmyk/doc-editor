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

/** PDF.js ascent/descent are usually fractions; reject font-unit scale values. */
function normalizeFontMetric(
  value: number | undefined,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (Math.abs(value) > 2) return fallback;
  return value;
}

export function parseFontTraits(fontName: string, fontFamily: string) {
  const combined = `${fontName} ${fontFamily}`.toLowerCase();
  const fontBold =
    (/\bbold\b|_bold\b|-bold\b|,bold\b|boldmt\b|bolditalic\b|black\b|heavy\b|semibold\b|demibold\b|extrabold\b|ultrabold\b|\b700\b|\b800\b|\b900\b/.test(
      combined,
    ) &&
      !/semilight|demilight|notbold|nonbold/.test(combined)) ||
  /(^|[^a-z])bd([^a-z]|$)/.test(combined);
  const fontItalic =
    /\bitalic\b|\boblique\b|_italic\b|-italic\b|,italic\b|-it\b|italicmt\b/.test(
      combined,
    );
  return { fontBold, fontItalic };
}

/** Map generic PDF.js families to concrete CSS stacks so weight renders correctly. */
export function resolveDisplayFontFamily(
  internalFontName: string,
  pdfFamily: string,
): string {
  const generic = pdfFamily.trim().toLowerCase();
  if (
    generic &&
    generic !== "sans-serif" &&
    generic !== "serif" &&
    generic !== "monospace"
  ) {
    return pdfFamily;
  }

  const lower = internalFontName.toLowerCase();
  if (lower.includes("courier") || lower.includes("mono")) {
    return "Courier New, Courier, monospace";
  }
  if (lower.includes("times") || lower.includes("roman")) {
    return "Times New Roman, Times, serif";
  }
  if (lower.includes("arial") || lower.includes("helvetica")) {
    return "Helvetica, Arial, sans-serif";
  }
  if (generic === "serif") return "Times New Roman, Times, serif";
  if (generic === "monospace") return "Courier New, Courier, monospace";
  return "Helvetica, Arial, sans-serif";
}

type PdfFontObject = {
  name?: string;
  loadedName?: string;
  fallbackName?: string;
};

type PdfPageWithFontObjects = {
  commonObjs: {
    get: (
      id: string,
      success: (obj: PdfFontObject) => void,
      failure?: (reason: unknown) => void,
    ) => void;
  };
};

async function loadPdfFontObject(
  page: PdfPageWithFontObjects,
  fontId: string,
): Promise<PdfFontObject | null> {
  return new Promise((resolve) => {
    page.commonObjs.get(
      fontId,
      (font) => resolve(font),
      () => resolve(null),
    );
  });
}

export async function resolvePdfFontStyleFromPage(
  page: PdfPageWithFontObjects,
  fontId: string | undefined,
  styles: Record<string, { fontFamily?: string; ascent?: number; descent?: number }>,
  cache: Map<string, PdfFontStyle>,
): Promise<PdfFontStyle> {
  if (!fontId) return DEFAULT_FONT;

  const cached = cache.get(fontId);
  if (cached) return cached;

  const styleEntry = styles[fontId];
  const fontObj = await loadPdfFontObject(page, fontId);
  const internalFontName =
    fontObj?.name?.trim() || fontObj?.loadedName?.trim() || fontId;
  const traits = parseFontTraits(
    internalFontName,
    styleEntry?.fontFamily ?? fontObj?.fallbackName ?? "",
  );
  const fontFamily = resolveDisplayFontFamily(
    internalFontName,
    styleEntry?.fontFamily?.trim() || fontObj?.fallbackName || "sans-serif",
  );

  const resolved: PdfFontStyle = {
    fontFamily,
    fontBold: traits.fontBold,
    fontItalic: traits.fontItalic,
    ascent: normalizeFontMetric(styleEntry?.ascent, DEFAULT_FONT.ascent),
    descent: normalizeFontMetric(styleEntry?.descent, DEFAULT_FONT.descent),
  };
  cache.set(fontId, resolved);
  return resolved;
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
    fontFamily: resolveDisplayFontFamily(fontName, fontFamily),
    fontBold: traits.fontBold,
    fontItalic: traits.fontItalic,
    ascent: normalizeFontMetric(style?.ascent, DEFAULT_FONT.ascent),
    descent: normalizeFontMetric(style?.descent, DEFAULT_FONT.descent),
  };
}

function boldFontFamilyStack(
  fontFamily: string,
  fontItalic: boolean,
): string {
  const lower = fontFamily.toLowerCase();
  if (lower.includes("courier") || lower.includes("mono")) {
    return fontItalic
      ? `"Courier New Bold Italic", "Courier-BoldOblique", ${fontFamily}`
      : `"Courier New Bold", "Courier-Bold", ${fontFamily}`;
  }
  if (
    lower.includes("times") ||
    (lower.includes("serif") && !lower.includes("sans"))
  ) {
    return fontItalic
      ? `"Times New Roman Bold Italic", "Times-BoldItalic", ${fontFamily}`
      : `"Times New Roman Bold", "Times-Bold", ${fontFamily}`;
  }
  return fontItalic
    ? `"Helvetica Bold Oblique", "Helvetica-BoldOblique", "Arial Bold Italic", ${fontFamily}`
    : `"Helvetica Bold", "Helvetica-Bold", "Arial Bold", ${fontFamily}`;
}

export function resolveHtmlFontStyle(
  style: Pick<PdfFontStyle, "fontFamily" | "fontBold" | "fontItalic">,
) {
  const fontStyle = style.fontItalic ? "italic" : "normal";
  if (!style.fontBold) {
    return {
      fontFamily: style.fontFamily,
      fontWeight: 400 as const,
      fontStyle,
    };
  }
  return {
    fontFamily: boldFontFamilyStack(style.fontFamily, style.fontItalic),
    // Use the named bold face at normal weight — avoids faux-bold thinning.
    fontWeight: 400 as const,
    fontStyle,
  };
}

export function buildCanvasFontCss(
  fontSize: number,
  style: Pick<PdfFontStyle, "fontFamily" | "fontBold" | "fontItalic">,
): string {
  const fontStyle = style.fontItalic ? "italic" : "normal";
  if (!style.fontBold) {
    return `${fontStyle} 400 ${fontSize}px ${style.fontFamily}`;
  }
  const family = boldFontFamilyStack(style.fontFamily, style.fontItalic);
  return `${fontStyle} 400 ${fontSize}px ${family}`;
}

/** Nudge canvas bold a hair thicker so it matches embedded PDF bold. */
export function fillCanvasTextWithBoldMatch(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  baselineY: number,
  fontBold: boolean,
) {
  ctx.fillText(text, x, baselineY);
  if (fontBold) {
    ctx.fillText(text, x + 0.22, baselineY);
  }
}

export function textBoxMetrics(
  fontSize: number,
  style: Pick<PdfFontStyle, "ascent" | "descent">,
) {
  const ascent = normalizeFontMetric(style.ascent, DEFAULT_FONT.ascent);
  const descent = normalizeFontMetric(style.descent, DEFAULT_FONT.descent);
  const span = Math.max(0.5, ascent - descent);
  const height = Math.max(fontSize * 0.8, fontSize * span);
  return {
    height,
    topOffset: fontSize * ascent,
  };
}

export function topFromBaseline(
  baselineY: number,
  fontSize: number,
  style: Pick<PdfFontStyle, "ascent">,
) {
  const ascent = normalizeFontMetric(style.ascent, DEFAULT_FONT.ascent);
  return baselineY - fontSize * ascent;
}

/** HTML inputs align text to a 1em box with the baseline at the bottom edge. */
export function inputTopFromBaseline(baselineY: number, fontSize: number): number {
  return baselineY - fontSize;
}

/** Downward tweak so inline editor text lines up with PDF.js glyphs. */
export function editTextVerticalNudge(fontSize: number): number {
  return fontSize * 0.1;
}

export function editOverlayTopFromBaseline(
  baselineY: number,
  matrixFontSize: number,
): number {
  return (
    inputTopFromBaseline(baselineY, matrixFontSize) +
    editTextVerticalNudge(matrixFontSize)
  );
}

export function inferBoldFromWidth(
  text: string,
  fontSize: number,
  targetWidth: number,
  style: Pick<PdfFontStyle, "fontFamily" | "fontBold" | "fontItalic">,
  measureWidth: (
    text: string,
    fontSize: number,
    font?: Pick<PdfFontStyle, "fontFamily" | "fontBold" | "fontItalic">,
  ) => number,
): boolean {
  if (style.fontBold) return true;
  if (!Number.isFinite(targetWidth) || targetWidth <= 0) return false;

  const regularWidth = measureWidth(text, fontSize, {
    fontFamily: style.fontFamily,
    fontBold: false,
    fontItalic: style.fontItalic,
  });
  if (regularWidth <= 0) return false;

  return targetWidth / regularWidth > 1.04;
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
