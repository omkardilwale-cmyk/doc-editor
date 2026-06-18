import type { PdfTextEdit, PdfTextItem } from "@/types/pdfText";
import { resolvePdfTextColor } from "@/lib/pdf/sampleTextColor";

export function editStyleFromItem(
  item: PdfTextItem,
  existingEdit?: PdfTextEdit,
): Pick<
  PdfTextEdit,
  "color" | "fontFamily" | "fontBold" | "fontItalic" | "ascent" | "descent"
> {
  return {
    color: resolvePdfTextColor(item, existingEdit?.color),
    fontFamily: existingEdit?.fontFamily ?? item.fontFamily,
    fontBold: existingEdit?.fontBold ?? item.fontBold,
    fontItalic: existingEdit?.fontItalic ?? item.fontItalic,
    ascent: existingEdit?.ascent ?? item.ascent,
    descent: existingEdit?.descent ?? item.descent,
  };
}
