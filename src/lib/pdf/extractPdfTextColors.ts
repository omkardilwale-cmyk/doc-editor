type PdfPageWithOperatorList = {
  getOperatorList: () => Promise<{
    fnArray: number[];
    argsArray: unknown[][];
  }>;
};

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

function grayToHex(value: unknown): string {
  const gray = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(gray)) return "#000000";
  const channel = Math.max(0, Math.min(255, Math.round(gray * 255)));
  const hex = channel.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}

/** Fill colors for each showText operator, in stream order. */
export async function extractTextFillColors(
  page: PdfPageWithOperatorList,
): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const { OPS } = pdfjs;
  const opList = await page.getOperatorList();
  const colors: string[] = [];
  let currentColor = "#000000";

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i] ?? [];

    if (fn === OPS.setFillRGBColor) {
      const hex = normalizeHexColor(args[0]);
      if (hex) currentColor = hex;
    } else if (fn === OPS.setFillGray) {
      currentColor = grayToHex(args[0]);
    } else if (fn === OPS.setFillCMYKColor && Array.isArray(args[0])) {
      const [c, m, y, k] = args[0] as number[];
      const r = Math.round(255 * (1 - c) * (1 - k));
      const g = Math.round(255 * (1 - m) * (1 - k));
      const b = Math.round(255 * (1 - y) * (1 - k));
      currentColor = `#${r.toString(16).padStart(2, "0")}${g
        .toString(16)
        .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
      colors.push(currentColor);
    }
  }

  return colors;
}
