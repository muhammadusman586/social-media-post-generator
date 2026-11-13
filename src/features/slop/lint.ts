/**
 * Deterministic slop linter. Pure: no I/O, safe on client and server.
 * Rules come from .claude/skills/no-ai-slop (SKILL.md, eval.md) and requirements §7.6.
 * Every flag is a warning except unresolved placeholders, which also block finalizing.
 */
import type { DraftContent, Platform, SlideContent } from "@/db/schema";
import { xIssues } from "@/features/drafts/x";

export type LintFlag = { rule: string; quote: string; suggestion: string };

type Rule = { rule: string; re: RegExp; suggestion: string };

/** Alternation of phrases, matched on word boundaries, case-insensitive. */
const words = (list: string[]) => new RegExp(`\\b(?:${list.join("|")})\\b`, "gi");

const RULES: Rule[] = [
  {
    rule: "Banned word",
    re: words([
      "delv(?:e|es|ed|ing)",
      "foster(?:s|ed|ing)?",
      "leverag(?:e|es|ed|ing)",
      "utili[sz](?:e|es|ed|ing)",
      "facilitat(?:e|es|ed|ing)",
      "empower(?:s|ed|ing|ment)?",
      "streamlin(?:e|es|ed|ing)",
      "robust(?:ly|ness)?",
      "cutting[- ]edge",
      "paradigm shifts?",
      "game[- ]changers?",
      "game[- ]changing",
      "this is huge",
      "this changes everything",
      "tapestry",
      "realms?",
      "beacons?",
      "multifaceted",
      "meticulous(?:ly)?",
      "intricate(?:ly)?",
      "paramount",
      "transformative",
      "elevat(?:e|es|ed|ing)",
      "embark(?:s|ed|ing)?",
      "supercharg(?:e|es|ed|ing)",
      "harness(?:es|ed|ing)?",
      "ever-evolving",
    ]),
    suggestion: "Use a plain word or a concrete fact.",
  },
  {
    rule: "Filler phrase",
    re: words([
      "it's worth noting",
      "it's important to note",
      "at the end of the day",
      "when it comes to",
      "at its core",
      "in today's world",
      "in the age of",
      "in the world of",
      "the reality is",
      "the truth is",
      "in terms of",
      "with regard to",
      "in order to",
      "going forward",
      "in this (?:article|post)",
      "let's dive in",
      "let's dive into",
    ]),
    suggestion: "Cut it and start with the point.",
  },
  {
    rule: "Throat-clearing opener",
    re: words([
      "here's the thing",
      "here's what i mean",
      "let me be clear",
      "i'll be honest",
      "the uncomfortable truth is",
    ]),
    suggestion: "Cut the opener and state the point.",
  },
  {
    rule: "Faux-insight setup",
    re: words([
      "(?:this is )?the part (?:most people|everyone) (?:skips?|miss(?:es)?)",
      "what (?:most people|everyone) gets? wrong",
      "here's what nobody tells you",
      "nobody (?:talks|is talking) about",
      "most people (?:don't|do not) (?:realize|know)",
    ]),
    suggestion: "Drop the setup and make the claim on its own.",
  },
  {
    rule: "Rhetorical setup",
    re: /\b(?:what if i told you|think about it:|plot twist:|guess what\b)/gi,
    suggestion: "Drop the setup and make the point.",
  },
  {
    rule: "Binary contrast",
    re: /\b(?:is not|isn't|wasn't|aren't|weren't|it's not|that's not)\b[^.!?\n]{1,80}[.,;—–]\s*(?:it's|it is|it was|this is|that's|they're|they are)\b/gi,
    suggestion: "State the second part directly.",
  },
  {
    rule: "Binary contrast",
    re: /\bnot (?:just|only)\b[^.!?\n]{1,80}\b(?:but|it's|it is)\b/gi,
    suggestion: "State the second part directly.",
  },
  {
    rule: "Negative listing",
    re: /(?:^|[.!?]\s+)not an? [^.!?\n]{1,40}[.!?]\s+not an? /gim,
    suggestion: "Say what it is.",
  },
  {
    // Case-sensitive on purpose: the reveal after the colon starts lowercase.
    rule: "Colon reveal",
    re: /(?:^|[.!?]\s+)(?:[Tt]he|[Mm]y|[Oo]ur|[Oo]ne|[Tt]his|[Tt]hat|[Hh]ere's)\b[^:\n.!?]{0,50}:[ \t]+[a-z]/gm,
    suggestion: "Rewrite as a plain sentence.",
  },
  {
    rule: "Superficial analysis",
    re: /,\s+(?:highlighting|underscoring|showcasing|reflecting|emphasizing|emphasising)\b/gi,
    suggestion: "Say what actually follows, or cut the clause.",
  },
  {
    rule: "Importance puffery",
    re: words([
      "stands? as a testament",
      "a testament to",
      "(?:marks|marked) a pivotal moment",
      "pivotal moment",
      "plays? an? (?:vital|crucial|key|pivotal) role",
      "underscores? (?:its|the) (?:significance|importance)",
      "solidif(?:y|ies) its position",
    ]),
    suggestion: "State the fact; let the reader judge.",
  },
  {
    rule: "Weasel attribution",
    re: words([
      "experts (?:agree|say)",
      "studies show",
      "many argue",
      "industry reports suggest",
      "widely regarded as",
      "research shows",
    ]),
    suggestion: "Name the source or cut the claim.",
  },
  {
    rule: "Metadiscourse",
    re: words([
      "that last part matters(?: more than it sounds)?",
      "the key point is",
      "as you can see",
      "this distinction matters",
    ]),
    suggestion: "Cut the aside; the content should show it.",
  },
  {
    rule: "Summary-recap ending",
    re: /^\s*(?:in conclusion|ultimately|overall|in summary|to sum up)\b/gim,
    suggestion: "End on the last concrete point instead.",
  },
];

const PLACEHOLDER = /\[ADD:[^\]\n]*\]?/g;
const EMOJI_LINE = /^\s*\p{Extended_Pictographic}/u;
const HASHTAG = /(?:^|\s)(#[\p{L}\p{N}_]+)/gu;

/** The whole line around `index`, trimmed and capped, so the owner can find it. */
function lineAt(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index - 1) + 1;
  const end = text.indexOf("\n", index);
  const line = text.slice(start, end === -1 ? undefined : end).trim();
  return line.length > 160 ? `${line.slice(0, 157)}…` : line;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when text still has an `[ADD: …]` placeholder. */
export function hasPlaceholder(text: string): boolean {
  return /\[ADD:/.test(text);
}

/** Lint one block of text (a LinkedIn post, an X post, a caption, a slide). */
export function lintText(raw: string, neverMention: string[] = []): LintFlag[] {
  const text = raw.replace(/[‘’]/g, "'");
  const flags: LintFlag[] = [];

  for (const { rule, re, suggestion } of RULES) {
    for (const m of text.matchAll(re)) flags.push({ rule, quote: lineAt(text, m.index), suggestion });
  }

  for (const m of text.matchAll(PLACEHOLDER)) {
    flags.push({ rule: "Missing fact", quote: m[0], suggestion: "Fill in the fact or delete the sentence." });
  }

  for (const name of neverMention.map((n) => n.trim()).filter(Boolean)) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(name)}(?![\\p{L}\\p{N}])`, "giu");
    for (const m of text.matchAll(re)) {
      flags.push({ rule: "Never-mention name", quote: lineAt(text, m.index), suggestion: `Remove "${name}".` });
    }
  }

  const emojiLines = text.split("\n").filter((l) => EMOJI_LINE.test(l));
  if (emojiLines.length >= 2) {
    flags.push({ rule: "Emoji bullet list", quote: emojiLines[0].trim(), suggestion: "Write it as prose or plain bullets." });
  }

  const dashes = text.match(/—/g)?.length ?? 0;
  if (dashes > 2) {
    flags.push({ rule: "Em dashes", quote: lineAt(text, text.indexOf("—")), suggestion: "Use commas or periods; keep 2 at most." });
  }

  return flags;
}

function hashtagFlag(text: string): LintFlag[] {
  const tags = [...text.matchAll(HASHTAG)].map((m) => m[1]);
  return tags.length > 3
    ? [{ rule: "Too many hashtags", quote: tags.join(" "), suggestion: `Keep 3 at most (now ${tags.length}).` }]
    : [];
}

function dedupe(flags: LintFlag[]): LintFlag[] {
  const seen = new Set<string>();
  return flags.filter((f) => {
    const key = `${f.rule}\n${f.quote}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Lint a whole platform draft (and Instagram slides). */
export function lintDraft(
  platform: Platform,
  content: DraftContent,
  slides: SlideContent[] = [],
  neverMention: string[] = [],
): LintFlag[] {
  if (platform === "x") {
    const posts = content.posts ?? [];
    return dedupe([
      ...posts.flatMap((p) => lintText(p, neverMention)),
      ...hashtagFlag(posts.join("\n")),
      ...xIssues(posts),
    ]);
  }
  if (platform === "instagram") {
    const caption = content.caption ?? "";
    const slideTexts = slides.map((s) => [s.heading, s.body, s.quote].filter(Boolean).join("\n"));
    return dedupe([
      ...[caption, ...slideTexts].flatMap((t) => lintText(t, neverMention)),
      ...slides.flatMap((s) =>
        [...(s.code ?? "").matchAll(PLACEHOLDER)].map((m) => ({
          rule: "Missing fact",
          quote: m[0],
          suggestion: "Fill in the fact or delete the line.",
        })),
      ),
      ...hashtagFlag(caption),
    ]);
  }
  const text = content.text ?? "";
  return dedupe([...lintText(text, neverMention), ...hashtagFlag(text)]);
}
