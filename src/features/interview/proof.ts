/**
 * Proof rules (requirements §4, §5, §8a). Pure, safe on client and server.
 * - tried: optional. Without the owner's screenshot/code the drafts become a "first look".
 * - explain: a diagram, the owner's own upload, or an approved AI-written example.
 * - lessons: a real situation in the answers, judged by an LLM check at finalize.
 */
import type { PostType } from "@/db/schema";
import { hasPlaceholder } from "@/features/slop/lint";

export type ProofUpload = {
  kind: "image" | "code";
  blobUrl: string | null;
  codeText: string | null;
  isGenerated: boolean;
  approvedAt: Date | null;
};

export type ProofInput = {
  type: PostType;
  uploads: ProofUpload[];
  hasDiagram: boolean;
  /** Result of the lessons LLM check; undefined when not run. */
  realSituation?: { ok: boolean; reason: string };
};

const hasContent = (u: ProofUpload) => Boolean(u.kind === "image" ? u.blobUrl : u.codeText?.trim());
const ownUpload = (u: ProofUpload) => !u.isGenerated && hasContent(u);
const pendingExample = (u: ProofUpload) => u.isGenerated && !u.approvedAt;

/** Why drafts cannot be generated yet, or null when they can. */
export function draftBlocker({ uploads }: ProofInput): string | null {
  if (uploads.some(pendingExample)) return "Approve or delete the AI-written example first.";
  return null;
}

/** Why the proof element is missing, or null when it is present. */
export function proofMissing({ type, uploads, hasDiagram, realSituation }: ProofInput): string | null {
  if (type === "tried") return null; // optional: no proof means a "first look" post
  if (type === "explain") {
    const approved = uploads.some((u) => u.isGenerated && u.approvedAt && hasContent(u));
    return hasDiagram || approved || uploads.some(ownUpload)
      ? null
      : "Add a diagram or a code snippet (yours, or an approved AI-written example).";
  }
  if (!realSituation) return "The real-situation check has not run yet.";
  return realSituation.ok ? null : `Your answers need a real situation from your work. ${realSituation.reason}`.trim();
}

/** Everything that blocks finalizing. Slop flags are warnings and never appear here. */
export function finalizeBlockers(input: ProofInput & { draftTexts: string[] }): string[] {
  const blockers: string[] = [];
  const proof = proofMissing(input);
  if (proof) blockers.push(proof);
  if (input.draftTexts.some(hasPlaceholder)) blockers.push("Fill in or delete every [ADD: …] placeholder.");
  return blockers;
}
