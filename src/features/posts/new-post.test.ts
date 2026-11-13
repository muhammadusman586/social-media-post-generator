import { describe, expect, it } from "vitest";
import { decideNewPost, parseNewPostParams } from "./new-post";

const ID = "7d1c2a4e-1b2c-4d5e-8f90-123456789abc";

describe("parseNewPostParams", () => {
  it("accepts a radar item with or without a type", () => {
    expect(parseNewPostParams({ type: "tried", radarItemId: ID })).toEqual({
      ok: true,
      value: { type: "tried", source: { kind: "radar", id: ID } },
    });
    expect(parseNewPostParams({ radarItemId: ID })).toEqual({
      ok: true,
      value: { type: undefined, source: { kind: "radar", id: ID } },
    });
  });

  it("forces lessons for a reflection", () => {
    expect(parseNewPostParams({ reflectionId: ID })).toEqual({
      ok: true,
      value: { type: "lessons", source: { kind: "reflection", id: ID } },
    });
    expect(parseNewPostParams({ type: "explain", reflectionId: ID }).ok).toBe(false);
  });

  it("rejects bad input", () => {
    expect(parseNewPostParams({}).ok).toBe(false);
    expect(parseNewPostParams({ radarItemId: ID, reflectionId: ID }).ok).toBe(false);
    expect(parseNewPostParams({ radarItemId: "1; drop table posts" }).ok).toBe(false);
    expect(parseNewPostParams({ radarItemId: [ID, ID] }).ok).toBe(false);
    expect(parseNewPostParams({ type: "thread", radarItemId: ID }).ok).toBe(false);
    expect(parseNewPostParams({ type: "lessons", radarItemId: ID }).ok).toBe(false);
  });
});

describe("decideNewPost", () => {
  const radar = { type: undefined, source: { kind: "radar" as const, id: ID } };
  const reflection = { type: "lessons" as const, source: { kind: "reflection" as const, id: ID } };

  it("reuses the existing post instead of creating a duplicate", () => {
    expect(decideNewPost(radar, { title: "t", answered: false }, "post-1")).toEqual({
      action: "existing",
      postId: "post-1",
    });
    // even when the source row is gone
    expect(decideNewPost(radar, undefined, "post-1")).toEqual({ action: "existing", postId: "post-1" });
  });

  it("errors on a missing source or an unanswered reflection", () => {
    expect(decideNewPost(radar, undefined, undefined).action).toBe("error");
    expect(decideNewPost(reflection, { title: "q", answered: false }, undefined).action).toBe("error");
  });

  it("creates with the URL type, else the radar suggestion", () => {
    expect(decideNewPost(radar, { title: "MCP", answered: false, suggestedType: "tried" }, undefined)).toEqual({
      action: "create",
      type: "tried",
      title: "MCP",
    });
    expect(
      decideNewPost({ ...radar, type: "explain" }, { title: "MCP", answered: false, suggestedType: "tried" }, undefined),
    ).toMatchObject({ type: "explain" });
    expect(decideNewPost(radar, { title: "x", answered: false, suggestedType: "lessons" }, undefined)).toMatchObject({
      type: "explain",
    });
    expect(decideNewPost(reflection, { title: "q", answered: true }, undefined)).toEqual({
      action: "create",
      type: "lessons",
      title: "q",
    });
  });
});
