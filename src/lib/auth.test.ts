import { afterEach, describe, expect, it, vi } from "vitest";
import { isOwner } from "./auth";

afterEach(() => vi.unstubAllEnvs());

describe("isOwner", () => {
  it("allows only the configured owner", () => {
    vi.stubEnv("OWNER_CLERK_USER_ID", "user_owner");
    expect(isOwner("user_owner")).toBe(true);
    expect(isOwner("user_other")).toBe(false);
    expect(isOwner(null)).toBe(false);
  });

  it("fails closed when OWNER_CLERK_USER_ID is unset", () => {
    vi.stubEnv("OWNER_CLERK_USER_ID", "");
    expect(isOwner("")).toBe(false);
    expect(isOwner(undefined)).toBe(false);
    expect(isOwner("user_any")).toBe(false);
  });
});
