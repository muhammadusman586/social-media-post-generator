import type { NewPostInput } from "./new-post";

/**
 * What a one-tap Quick post writes about: in a lessons week an answered, unused reflection
 * (falling back to radar), otherwise the top unused radar item (falling back to a reflection).
 * Lists arrive best-first.
 */
export function pickQuickSource(o: {
  lessonsWeek: boolean;
  radar: { id: string }[];
  reflections: { id: string }[];
}): NewPostInput | null {
  const radar: NewPostInput | null = o.radar[0] ? { source: { kind: "radar", id: o.radar[0].id } } : null;
  const reflection: NewPostInput | null = o.reflections[0]
    ? { type: "lessons", source: { kind: "reflection", id: o.reflections[0].id } }
    : null;
  return o.lessonsWeek ? (reflection ?? radar) : (radar ?? reflection);
}
