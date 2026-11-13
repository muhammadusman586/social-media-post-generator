import { describe, expect, it } from "vitest";
import { hasPlaceholder, lintDraft, lintText } from "./lint";

const rules = (text: string, never: string[] = []) => lintText(text, never).map((f) => f.rule);

describe("lintText: banned words and phrases", () => {
  it.each([
    ["We delve into the code.", "Banned word"],
    ["This lets you leverage caching.", "Banned word"],
    ["Teams utilize it daily.", "Banned word"],
    ["A robust pipeline.", "Banned word"],
    ["A real game-changer for evals.", "Banned word"],
    ["It's a game changer.", "Banned word"],
    ["This changes everything.", "Banned word"],
    ["We harnessed the model.", "Banned word"],
    ["The ever-evolving world of AI.", "Banned word"],
    ["Let's dive in.", "Filler phrase"],
    ["It's worth noting that it failed.", "Filler phrase"],
    ["In order to ship, we cut scope.", "Filler phrase"],
    ["At the end of the day it works.", "Filler phrase"],
    ["Here's the thing: evals are slow.", "Throat-clearing opener"],
    ["What most people get wrong about RAG.", "Faux-insight setup"],
    ["Here's what nobody tells you about agents.", "Faux-insight setup"],
    ["Plot twist: it was the cache.", "Rhetorical setup"],
    ["The launch is a testament to the team.", "Importance puffery"],
    ["Experts agree this is the future.", "Weasel attribution"],
    ["As you can see, latency dropped.", "Metadiscourse"],
    ["It adds file search, highlighting the focus on speed.", "Superficial analysis"],
  ])("flags %j", (text, rule) => {
    expect(rules(text)).toContain(rule);
  });

  it("handles curly apostrophes", () => {
    expect(rules("Let’s dive in.")).toContain("Filler phrase");
  });

  it("is case-insensitive for word rules", () => {
    expect(rules("DELVE deeper")).toContain("Banned word");
  });

  it("does not flag substrings of other words", () => {
    expect(rules("The elevator broke and the harbor flooded.")).toEqual([]);
  });

  it("passes plain, concrete writing", () => {
    const text =
      "I moved our evals from a notebook to CI last week.\nRuns went from 40 minutes to 6.\nThe slow part was loading fixtures, so I cached them.";
    expect(lintText(text)).toEqual([]);
  });
});

describe("lintText: patterns", () => {
  it("flags binary contrasts across a sentence break", () => {
    expect(rules("This is not a model problem. It's an eval problem.")).toContain("Binary contrast");
    expect(rules("The question isn't the model, it's the eval.")).toContain("Binary contrast");
    expect(rules("It's not just faster but cheaper.")).toContain("Binary contrast");
    expect(rules("Not only fast but also cheap.")).toContain("Binary contrast");
  });

  it("does not flag an ordinary negative sentence", () => {
    expect(rules("It isn't documented anywhere, so I read the source.")).not.toContain("Binary contrast");
  });

  it("flags negative listing", () => {
    expect(rules("Not a framework. Not a library. A protocol.")).toContain("Negative listing");
  });

  it("flags colon reveals with a lowercase reveal", () => {
    expect(rules("The best part: it learns.")).toContain("Colon reveal");
    expect(rules("I tried it. The detail that makes it work: a separate agent grades it.")).toContain("Colon reveal");
  });

  it("does not flag labels or capitalized lists", () => {
    expect(rules("Stack: Next.js, Neon, Trigger.dev")).not.toContain("Colon reveal");
    expect(rules("The steps: Install, Run, Check.")).not.toContain("Colon reveal");
  });

  it("flags emoji bullet lists, not a single emoji", () => {
    expect(rules("Wins:\n✅ faster\n🚀 cheaper\n🔥 simpler")).toContain("Emoji bullet list");
    expect(rules("Shipped it 🚀")).not.toContain("Emoji bullet list");
    expect(rules("✅ one line only")).not.toContain("Emoji bullet list");
  });

  it("flags summary-recap endings", () => {
    expect(rules("We cut latency.\n\nIn conclusion, caching works.")).toContain("Summary-recap ending");
    expect(rules("Ultimately, it was worth it.")).toContain("Summary-recap ending");
  });

  it("flags more than 2 em dashes", () => {
    expect(rules("a — b — c — d")).toContain("Em dashes");
    expect(rules("a — b — c")).not.toContain("Em dashes");
  });
});

describe("lintText: placeholders and never-mention", () => {
  it("flags each [ADD: …] placeholder with its text", () => {
    const flags = lintText("We cut it by [ADD: how much]. Then [ADD: what broke].");
    expect(flags.filter((f) => f.rule === "Missing fact").map((f) => f.quote)).toEqual([
      "[ADD: how much]",
      "[ADD: what broke]",
    ]);
  });

  it("detects placeholders", () => {
    expect(hasPlaceholder("x [ADD: number] y")).toBe(true);
    expect(hasPlaceholder("x [add] y")).toBe(false);
  });

  it("flags never-mention names case-insensitively and quotes the line", () => {
    const flags = lintText("Intro line.\nWorking with acme corp taught me this.", ["Acme Corp"]);
    expect(flags).toContainEqual({
      rule: "Never-mention name",
      quote: "Working with acme corp taught me this.",
      suggestion: 'Remove "Acme Corp".',
    });
  });

  it("matches names on word boundaries and escapes regex characters", () => {
    expect(rules("Acmeville is a town.", ["Acme"])).not.toContain("Never-mention name");
    expect(rules("We used C++ there.", ["C++"])).toContain("Never-mention name");
    expect(rules("anything", ["  ", ""])).toEqual([]);
  });
});

describe("lintDraft", () => {
  it("flags more than 3 hashtags on LinkedIn", () => {
    const flags = lintDraft("linkedin", { text: "Post.\n#ai #llm #evals #nextjs" });
    expect(flags).toContainEqual(expect.objectContaining({ rule: "Too many hashtags", quote: "#ai #llm #evals #nextjs" }));
    expect(lintDraft("linkedin", { text: "Post.\n#ai #llm #evals" })).toEqual([]);
  });

  it("does not count headings or C# as hashtags", () => {
    expect(lintDraft("linkedin", { text: "I write C# and #1 #2 #3" })).toEqual([]);
  });

  it("checks X post length and thread size", () => {
    const long = "a".repeat(281);
    const rulesOf = (posts: string[]) => lintDraft("x", { posts }).map((f) => f.rule);
    expect(rulesOf([long])).toContain("X post over 280 characters");
    expect(rulesOf(["one", "two"])).toContain("X thread length");
    expect(rulesOf(["1", "2", "3"])).toEqual([]);
    expect(rulesOf(["1", "a".repeat(278), "3"])).toContain("X post over 276 characters");
    expect(rulesOf(["1", "2", "3", "4", "5", "6", "7"])).toContain("X thread length");
  });

  it("counts hashtags across an X thread", () => {
    const flags = lintDraft("x", { posts: ["a #one #two", "b #three", "c #four"] });
    expect(flags.map((f) => f.rule)).toContain("Too many hashtags");
  });

  it("lints Instagram caption and slides, including placeholders in code", () => {
    const flags = lintDraft(
      "instagram",
      { caption: "Caption." },
      [
        { heading: "Let's dive in" },
        { code: "const x = [ADD: real value];" },
        { quote: "We worked with Initech." },
      ],
      ["Initech"],
    );
    expect(flags.map((f) => f.rule).sort()).toEqual(["Filler phrase", "Missing fact", "Never-mention name"]);
  });

  it("dedupes identical flags", () => {
    const flags = lintDraft("linkedin", { text: "We leverage it, leverage it." });
    expect(flags).toHaveLength(1);
  });
});
