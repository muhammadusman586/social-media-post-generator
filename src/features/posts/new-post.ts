import { postType, type PostType } from "@/db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export type NewPostSource = { kind: "radar" | "reflection"; id: string };
/** `type` is undefined when the URL leaves it out; the radar item's suggestion fills it in. */
export type NewPostInput = { type?: PostType; source: NewPostSource };

type Params = Record<string, string | string[] | undefined>;
type Parsed = { ok: true; value: NewPostInput } | { ok: false; error: string };

export function parseNewPostParams(params: Params): Parsed {
  const get = (key: string) => {
    const v = params[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const radarItemId = get("radarItemId");
  const reflectionId = get("reflectionId");
  const rawType = get("type");

  if (Boolean(radarItemId) === Boolean(reflectionId)) {
    return { ok: false, error: "Start a post from one radar item or one reflection." };
  }
  const id = (radarItemId ?? reflectionId)!;
  if (!isUuid(id)) return { ok: false, error: "That link has a broken id." };

  if (rawType && !(postType.enumValues as readonly string[]).includes(rawType)) {
    return { ok: false, error: `Unknown post type "${rawType}".` };
  }
  const type = rawType as PostType | undefined;

  if (radarItemId) {
    if (type === "lessons") return { ok: false, error: "Lessons posts start from a reflection, not a radar item." };
    return { ok: true, value: { type, source: { kind: "radar", id } } };
  }
  if (type && type !== "lessons") return { ok: false, error: "A reflection can only start a lessons post." };
  return { ok: true, value: { type: "lessons", source: { kind: "reflection", id } } };
}

export type SourceRow = { title: string; answered: boolean; suggestedType?: PostType };

export type Decision =
  | { action: "existing"; postId: string }
  | { action: "create"; type: PostType; title: string }
  | { action: "error"; error: string };

/**
 * What `/posts/new` should do. A source that already has a post always goes back to
 * that post, so a double tap or a reload never creates a second one.
 */
export function decideNewPost(
  input: NewPostInput,
  source: SourceRow | undefined,
  existingPostId: string | undefined,
): Decision {
  if (existingPostId) return { action: "existing", postId: existingPostId };
  if (!source) return { action: "error", error: "That radar item or reflection no longer exists." };

  if (input.source.kind === "reflection") {
    if (!source.answered) return { action: "error", error: "Answer this reflection before you write about it." };
    return { action: "create", type: "lessons", title: source.title };
  }
  const type = input.type ?? (source.suggestedType === "tried" ? "tried" : "explain");
  return { action: "create", type, title: source.title };
}
