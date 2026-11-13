/**
 * Proof rules (requirements §4, §5, §8a). Pure, safe on client and server.
 * - tried: the owner's own screenshot or pasted code.
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
export function draftBlocker({ type, uploads }: ProofInput): string | null {
  if (uploads.some(pendingExample)) return "Approve or delete the AI-written example first.";
  if (type === "tried" && !uploads.some(ownUpload)) return "Add a screenshot or paste code from what you tried.";
  return null;
}

/** Why the proof element is missing, or null when it is present. */
export function proofMissing({ type, uploads, hasDiagram, realSituation }: ProofInput): string | null {
  if (type === "tried") {
    return uploads.some(ownUpload) ? null : "Add a screenshot or paste code from what you tried.";
  }
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
