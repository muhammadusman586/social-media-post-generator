/** X (Twitter) post limits and thread editing helpers. Pure, safe on client and server. */

export const X_LIMIT = 280;
export const THREAD_MIN = 3;
export const THREAD_MAX = 6;

/**
 * Characters as X counts them, roughly.
 * shortcut: counts Unicode code points; X counts URLs as 23 and CJK/emoji as 2. Switch to
 * twitter-text if posts with links or emoji get rejected.
 */
export function xLength(post: string): number {
  return [...post].length;
}

/**
 * Character limit for one post. Thread posts are stored without numbering; the post kit
 * appends " i/n" when copying, so a thread post must leave room for it (274 for n < 10).
 */
export function xLimit(threadSize: number): number {
  return threadSize > 1 ? X_LIMIT - ` ${threadSize}/${threadSize}`.length : X_LIMIT;
}

/** Drop "1/4"-style numbering the model may add; the post kit numbers posts itself. */
export function stripNumbering(post: string): string {
  return post.replace(/^\s*\(?\d+\s*\/\s*\d+\)?[.:]?\s+/, "").replace(/\s+\(?\d+\s*\/\s*\d+\)?\s*$/, "").trim();
}

/** Thread editing format: posts separated by a line containing only `---`. */
export function parseThread(text: string): string[] {
  return text
    .split(/^[ \t]*---[ \t]*$/m)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function formatThread(posts: string[]): string {
  return posts.join("\n\n---\n\n");
}

export type XIssue = { rule: string; quote: string; suggestion: string };

/** Length and thread-size problems: 1 post ≤ 280, or a 3-6 post thread with room for " i/n". */
export function xIssues(posts: string[]): XIssue[] {
  const issues: XIssue[] = [];
  const limit = xLimit(posts.length);
  posts.forEach((post, i) => {
    const n = xLength(post);
    if (n > limit) {
      issues.push({
        rule: `X post over ${limit} characters`,
        quote: `Post ${i + 1}: ${post.slice(0, 80)}${post.length > 80 ? "…" : ""}`,
        suggestion: `Cut ${n - limit} characters or split it (now ${n}${posts.length > 1 ? `, numbering adds ${X_LIMIT - limit}` : ""}).`,
      });
    }
  });
  if (posts.length === 2 || posts.length > THREAD_MAX) {
    issues.push({
      rule: "X thread length",
      quote: `${posts.length} posts`,
      suggestion: `Use a single post or a thread of ${THREAD_MIN}-${THREAD_MAX} posts.`,
    });
  }
  return issues;
}
