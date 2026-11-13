import type { DraftContent, SlideContent } from "@/db/schema";

export function draftText(content: DraftContent, slides: SlideContent[] = []): string {
  return [
    content.text,
    ...(content.posts ?? []),
    content.caption,
    ...slides.flatMap((s) => [s.heading, s.body, s.quote, s.code]),
  ]
    .filter((t) => t?.trim())
    .join("\n\n");
}
