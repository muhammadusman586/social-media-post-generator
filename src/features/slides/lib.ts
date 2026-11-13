import type { SlideContent } from "@/db/schema";

export type SlideKind = "title" | "text" | "diagram" | "code" | "quote";

export const SLIDE_SIZE = { width: 1080, height: 1350 } as const;

/**
 * Which template draws a slide. A slide missing the field its kind needs falls back to
 * the text template, so a half-filled row still renders something readable.
 */
export function slideTemplate(
  kind: SlideKind,
  content: SlideContent,
  diagramPngUrl?: string | null,
): SlideKind {
  if (kind === "diagram") return (content.imageUrl ?? diagramPngUrl) ? "diagram" : "text";
  if (kind === "code") return content.code?.trim() ? "code" : "text";
  if (kind === "quote") return content.quote?.trim() ? "quote" : "text";
  return kind;
}

export function fitFontSize(text: string, max: number, min: number): number {
  const len = text.length;
  if (len <= 60) return max;
  if (len >= 600) return min;
  return Math.round(max - ((max - min) * (len - 60)) / 540);
}
