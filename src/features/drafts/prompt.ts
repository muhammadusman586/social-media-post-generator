/**
 * Draft prompt builder. Pure, so tests can check exactly which facts reach the model.
 * Facts allowed in a draft: the radar item (or reflection), answered interview questions,
 * the owner's uploads, and approved AI-written examples (illustrative, never experience).
 */
import type { Platform, PostType } from "@/db/schema";
import { STYLE_RULES } from "@/features/slop/rules";
import type { ProofUpload } from "@/features/interview/proof";

export type DraftContext = {
  post: { type: PostType; title: string };
  profile: { handle: string; bio: string; stack: string[]; topics: string[]; neverMention: string[] } | null;
  /** Owner's writing samples and recent final posts, newest first. Style only. */
  voice: string[];
  item: { title: string; url: string; summary: string; whyItMatters: string } | null;
  reflection: { question: string; answer: string | null } | null;
  qas: { question: string; answer: string | null }[];
  uploads: ProofUpload[];
  hasDiagram: boolean;
};

const TYPE_GOAL: Record<PostType, string> = {
  explain: "Explain it simply: explain the concept so a junior engineer gets it, using the owner's own explanation and examples.",
  tried:
    "I tried it: tell what the owner built or tried, what worked, and what broke or surprised them. If the answers and attachments do not show the owner actually used it, write a first-look post instead: what it is, why it matters for the owner's stack, and what they plan to try. Never say or imply they built, ran or tested it, and use no [ADD: …] placeholders for missing results.",
  lessons: "2-year lessons: tell the real situation from the owner's work and what they learned. Never name clients or employers.",
};

const PLATFORM_RULES: Record<Platform, (type: PostType) => string> = {
  linkedin: () =>
    "LinkedIn post: 150-250 words, short paragraphs, the hook in the first 2 lines, at most 3 hashtags at the end. Return it in `text`.",
  x: () =>
    "X: either one post of at most 280 characters, or a thread of 3-6 posts, each at most 274 characters. Return the posts in `posts` (1 item for a single post). Never number the posts (no 1/5); numbering is added when posting.",
  instagram: (type) =>
    `Instagram: a caption (short, at most 3 hashtags) plus slides. ${
      type === "explain"
        ? "Make 6-7 slides: a title slide, text slides that explain step by step, and a code slide if there is code. Add one diagram slide (heading only) where a picture helps; the diagram image is attached later."
        : type === "lessons"
          ? "Make exactly 1 slide of kind quote: the lesson in the owner's words, at most 25 words."
          : "Slides are optional: 0-5 slides (title, text, code). Use none if the post works without them."
    } Slide kinds: title, text, diagram, code, quote. Fill only the fields a slide needs; set the rest to null.`,
};

const section = (title: string, body: string) => `## ${title}\n${body.trim()}\n`;

export function buildDraftPrompt(
  ctx: DraftContext,
  platform: Platform,
  opts: { instruction?: string; previous?: string } = {},
): { instructions: string; prompt: string } {
  const avoid = ctx.profile?.neverMention.filter(Boolean) ?? [];

  const instructions = [
    "You turn an engineer's own rough answers into a post in their voice. The post is in English even if the answers mix English and Roman Urdu.",
    "Hard rule: use only facts from the SOURCE, the ANSWERS and the PROOF sections. Never invent what the owner did, tried, felt, learned, measured or thinks.",
    "When the post needs a fact that is not there (a number, a result, a detail), write a visible placeholder like [ADD: how long the migration took] instead of making it up.",
    "The PROFILE is background for tone and wording only; do not state anything from it as something the owner did in this post.",
    "VOICE examples show how the owner writes. Copy the style, never the content.",
    "AI-written examples in PROOF are illustrative code, not the owner's experience; do not claim the owner wrote or shipped them.",
    avoid.length ? `Never mention these names: ${avoid.join(", ")}.` : "",
    `Post type. ${TYPE_GOAL[ctx.post.type]}`,
    ctx.qas.some((q) => q.answer?.trim()) || ctx.reflection?.answer?.trim()
      ? ""
      : "There are no answers from the owner yet. Write from the SOURCE alone: explain or share what it is and why it matters for the owner's stack. No first-person claims of experience, and no [ADD: …] placeholders for personal details.",
    PLATFORM_RULES[platform](ctx.post.type),
    STYLE_RULES,
  ]
    .filter(Boolean)
    .join("\n\n");

  const parts: string[] = [];

  if (ctx.profile) {
    const p = ctx.profile;
    parts.push(
      section(
        "PROFILE (background only)",
        [p.handle && `Handle: ${p.handle}`, p.bio && `Bio: ${p.bio}`, p.stack.length && `Stack: ${p.stack.join(", ")}`, p.topics.length && `Topics: ${p.topics.join(", ")}`]
          .filter(Boolean)
          .join("\n") || "(empty)",
      ),
    );
  }

  if (ctx.voice.length) {
    parts.push(section("VOICE (style only)", ctx.voice.map((v, i) => `Example ${i + 1}:\n${v}`).join("\n\n")));
  }

  if (ctx.item) {
    parts.push(
      section(
        "SOURCE",
        `Title: ${ctx.item.title}\nURL: ${ctx.item.url}\nSummary: ${ctx.item.summary}\nWhy it matters to the owner: ${ctx.item.whyItMatters}`,
      ),
    );
  }
  if (ctx.reflection) {
    parts.push(section("SOURCE (reflection)", `Question: ${ctx.reflection.question}\nOwner's answer: ${ctx.reflection.answer ?? "(none)"}`));
  }

  const answered = ctx.qas.filter((q) => q.answer?.trim());
  parts.push(
    section(
      "ANSWERS (the owner's own words)",
      answered.length ? answered.map((q) => `Q: ${q.question}\nA: ${q.answer!.trim()}`).join("\n\n") : "(no answers yet)",
    ),
  );

  const proof: string[] = [];
  for (const u of ctx.uploads) {
    if (u.kind === "image" && u.blobUrl && !u.isGenerated) proof.push("The owner attached a screenshot (shown with the post; do not describe what is in it).");
    if (u.kind === "code" && u.codeText?.trim()) {
      if (!u.isGenerated) proof.push(`The owner's code:\n\`\`\`\n${u.codeText.trim()}\n\`\`\``);
      else if (u.approvedAt) proof.push(`AI-written illustrative example (approved):\n\`\`\`\n${u.codeText.trim()}\n\`\`\``);
    }
  }
  if (ctx.hasDiagram) proof.push("A diagram is attached to the post.");
  parts.push(section("PROOF", proof.length ? proof.join("\n\n") : "(none)"));

  if (opts.previous) parts.push(section("PREVIOUS DRAFT", opts.previous));
  if (opts.instruction?.trim()) parts.push(section("OWNER'S INSTRUCTION FOR THIS VERSION", opts.instruction.trim()));

  return { instructions, prompt: parts.join("\n") };
}
