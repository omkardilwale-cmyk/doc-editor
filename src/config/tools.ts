export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: string;
  available: boolean;
}

/** Central registry — add new tools here and create a matching route under `src/app/`. */
export const TOOLS: ToolDefinition[] = [
  {
    id: "pdf-editor",
    name: "PDF Editor",
    description:
      "Upload a PDF, edit existing text, add annotations, and download your changes.",
    href: "/pdfeditor",
    icon: "PDF",
    available: true,
  },
];

export function getToolByHref(href: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.href === href);
}
